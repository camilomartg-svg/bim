import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestore-errors';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
  connectGoogleDrive: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('google_drive_token');
    const expiry = localStorage.getItem('google_drive_token_expiry');
    if (token && expiry && Date.now() < Number(expiry)) {
      return token;
    }
    return null;
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        let assignedPosition = 'Interventor Eléctrico'; // Default
        let assignedTeam = '';
        let role: "admin" | "manager" | "technician" | "client" = 'technician';

        // Set immediate admin fallback for explicit admin email to prevent security rules mismatch
        if (fbUser.email && fbUser.email.toLowerCase() === 'imagina3ddesign@gmail.com') {
          role = 'admin';
          assignedPosition = 'ADMINISTRADOR DE SISTEMA';
        }

        // 1. Immediately unblock the loading state and display screen with fallback user info
        const immediateUser: User = {
          id: fbUser.uid,
          name: fbUser.displayName || 'BIM User',
          email: fbUser.email || '',
          role: role,
          position: assignedPosition,
          team: assignedTeam
        };
        setUser(immediateUser);
        setLoading(false);

        // 2. Perform Firestore checks in the background without holding up the UI thread
        try {
          let teamPosition = assignedPosition;
          let teamGroup = assignedTeam;
          let teamRole = role;

          try {
            const teamQuery = query(collection(db, 'team'), where('email', '==', fbUser.email));
            const teamSnap = await getDocs(teamQuery);
            if (!teamSnap.empty) {
              const teamData = teamSnap.docs[0].data();
              teamPosition = teamData.position || teamPosition;
              teamGroup = teamData.team || '';
              teamRole = teamData.role || teamRole;
            }
          } catch (teamErr) {
            console.warn("Could not fetch team info, using default/email fallback", teamErr);
          }

          const userDocRef = doc(db, 'users', fbUser.uid);
          let userData: User | null = null;
          
          try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              userData = userDoc.data() as User;
            }
          } catch (userErr) {
            console.warn("Could not fetch user doc", userErr);
          }
          
          if (userData) {
            // Update position, team or role if it changed
            if (userData.position !== teamPosition || userData.team !== teamGroup || userData.role !== teamRole) {
              const updatedUser = { 
                ...userData, 
                position: teamPosition, 
                team: teamGroup,
                role: teamRole
              };
              try {
                await setDoc(userDocRef, updatedUser, { merge: true });
              } catch (saveErr) {
                console.warn("Could not sync user info to Firestore", saveErr);
              }
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            // New user registration
            const newUser: User = {
              id: fbUser.uid,
              name: fbUser.displayName || 'BIM User',
              email: fbUser.email || '',
              role: teamRole,
              position: teamPosition,
              team: teamGroup
            };
            try {
              await setDoc(userDocRef, newUser);
            } catch (regErr) {
              console.warn("Could not register user doc in Firestore", regErr);
            }
            setUser(newUser);
          }
        } catch (err) {
          console.error("Auth sync background error:", err);
        }
      } else {
        setUser(null);
        setGoogleAccessToken(null);
        localStorage.removeItem('google_drive_token');
        localStorage.removeItem('google_drive_token_expiry');
        setLoading(false);
      }
    });
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('google_drive_token', credential.accessToken);
        localStorage.setItem('google_drive_token_expiry', (Date.now() + 3300 * 1000).toString());
      }
    } catch (err) {
      console.error("Error during Google sign-in with Drive scopes:", err);
      throw err;
    }
  };

  const connectGoogleDrive = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    if (!auth.currentUser) {
      throw new Error("No hay un usuario autenticado para vincular Google Drive.");
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('google_drive_token', credential.accessToken);
        localStorage.setItem('google_drive_token_expiry', (Date.now() + 3300 * 1000).toString());
      } else {
        throw new Error("No se pudo obtener el token de acceso de Google Drive.");
      }
    } catch (err) {
      console.error("Error connecting Google Drive:", err);
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGoogleAccessToken(null);
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_token_expiry');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout, googleAccessToken, setGoogleAccessToken, connectGoogleDrive }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
