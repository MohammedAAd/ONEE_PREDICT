# backend/auth.py
from fastapi import FastAPI, HTTPException, Depends, status, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key_change_me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

# Configuration PostgreSQL
POSTGRES_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "onee_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "2012")
}

DATABASE_URL = f"postgresql://{POSTGRES_CONFIG['user']}:{POSTGRES_CONFIG['password']}@{POSTGRES_CONFIG['host']}:{POSTGRES_CONFIG['port']}/{POSTGRES_CONFIG['database']}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Modèles Pydantic
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    immatriculation: str
    nom: Optional[str] = None
    prenom: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    immatriculation: str
    nom: Optional[str] = None
    prenom: Optional[str] = None
    is_admin: bool
    is_active: bool
    last_login: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Fonctions utilitaires
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_by_email(db: Session, email: str):
    result = db.execute(
        text("SELECT * FROM users WHERE email = :email AND is_active = TRUE"),
        {"email": email}
    )
    return result.fetchone()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user

# Routes
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@auth_router.post("/login", response_model=Token)
async def login(user_login: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, user_login.email, user_login.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    
    db.execute(
        text("UPDATE users SET last_login = NOW() WHERE id = :id"),
        {"id": user.id}
    )
    db.commit()
    
    access_token = create_access_token(
        data={"sub": user.email, "id": user.id, "is_admin": user.is_admin}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            immatriculation=user.immatriculation,
            nom=user.nom,
            prenom=user.prenom,
            is_admin=user.is_admin,
            is_active=user.is_active,
            last_login=user.last_login
        )
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user = get_user_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return UserResponse(
        id=user.id,
        email=user.email,
        immatriculation=user.immatriculation,
        nom=user.nom,
        prenom=user.prenom,
        is_admin=user.is_admin,
        is_active=user.is_active,
        last_login=user.last_login
    )

@auth_router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    except:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    users = db.execute(
        text("SELECT id, email, immatriculation, nom, prenom, is_admin, is_active, last_login FROM users ORDER BY id")
    ).fetchall()
    
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            immatriculation=u.immatriculation,
            nom=u.nom,
            prenom=u.prenom,
            is_admin=u.is_admin,
            is_active=u.is_active,
            last_login=u.last_login
        ) for u in users
    ]

@auth_router.post("/users")
async def create_user_by_admin(
    user: UserCreate,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    except:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": user.email}
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    existing_immat = db.execute(
        text("SELECT id FROM users WHERE immatriculation = :immatriculation"),
        {"immatriculation": user.immatriculation}
    ).fetchone()
    if existing_immat:
        raise HTTPException(status_code=400, detail="Immatriculation déjà utilisée")
    
    password_hash = get_password_hash(user.password)
    
    db.execute(
        text("""
            INSERT INTO users (email, password_hash, immatriculation, nom, prenom, is_admin, is_active)
            VALUES (:email, :password_hash, :immatriculation, :nom, :prenom, FALSE, TRUE)
        """),
        {
            "email": user.email,
            "password_hash": password_hash,
            "immatriculation": user.immatriculation,
            "nom": user.nom,
            "prenom": user.prenom
        }
    )
    db.commit()
    
    return {"message": "Utilisateur créé avec succès"}

@auth_router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    except:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user = db.execute(
        text("SELECT is_active FROM users WHERE id = :id"),
        {"id": user_id}
    ).fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    new_status = not user.is_active
    db.execute(
        text("UPDATE users SET is_active = :is_active WHERE id = :id"),
        {"is_active": new_status, "id": user_id}
    )
    db.commit()
    
    return {"message": f"Utilisateur {'activé' if new_status else 'désactivé'}"}

@auth_router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    except:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    if user_id == 1:
        raise HTTPException(status_code=400, detail="Impossible de supprimer l'admin principal")
    
    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    db.commit()
    
    return {"message": "Utilisateur supprimé avec succès"}