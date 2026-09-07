"""Registration + login. Issues JWT bearer tokens; no session/cookie state."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import User
from app.schemas import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/google", response_model=RegisterResponse)
def google_auth(payload: GoogleAuthRequest, db: DBSession = Depends(get_db)):
    email = str(payload.email).strip().lower()
    base_username = payload.name.strip() if payload.name and payload.name.strip() else email.split("@")[0]
    username = base_username.lower().replace(" ", "_")

    # Look up by email or username
    user = db.query(User).filter((User.email == email) | (User.username == username)).first()
    if user is None:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(f"google-oauth-{email}"),
            display_name=payload.name or base_username,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.username == username).first()
        db.refresh(user)

    token = create_access_token(user.id)
    return RegisterResponse(user=UserResponse.model_validate(user), access_token=token)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DBSession = Depends(get_db)):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    db.refresh(user)

    token = create_access_token(user.id)
    return RegisterResponse(user=UserResponse.model_validate(user), access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DBSession = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)
