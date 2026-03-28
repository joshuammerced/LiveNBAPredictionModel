import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Replace with your actual credentials or use Environment Variables for security
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "password")
DB_HOST = os.getenv("DB_HOST", "localhost") 
DB_NAME = os.getenv("DB_NAME", "nba_predictions")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

Base = declarative_base()

class GameLog(Base):
    __tablename__ = 'game_logs'
    id = Column(Integer, primary_key=True)
    game_id = Column(String, unique=True, nullable=False)
    game_date = Column(Date, nullable=False)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    home_pts = Column(Integer)
    away_pts = Column(Integer)
    season = Column(String)

class PlayerStat(Base):
    __tablename__ = 'player_stats'
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, nullable=False)
    game_id = Column(String, ForeignKey('game_logs.game_id'))
    pts = Column(Integer)
    reb = Column(Integer)
    ast = Column(Integer)
    min = Column(String)

def init_db():
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)
    print(f"Database {DB_NAME} and tables initialized successfully.")

if __name__ == "__main__":
    init_db()