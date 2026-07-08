from typing import Generic, TypeVar, Type, List, Optional, Dict, Any, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from abc import ABC, abstractmethod

ModelType = TypeVar("ModelType")

class BaseRepository(ABC, Generic[ModelType]):
    
    def __init__(self, db: AsyncSession):
        """Initialise le repository avec une session de base de données"""
        self.db = db  # ← Ceci est CRITIQUE
    
    @abstractmethod
    def get_model(self) -> Type[ModelType]:
        pass
    
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[ModelType]:
        stmt = select(self.get_model()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)  # ← Utilise self.db
        return result.scalars().all()
    
    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.get_model())
        result = await self.db.execute(stmt)
        return result.scalar()