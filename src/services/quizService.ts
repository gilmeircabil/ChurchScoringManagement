import { IDatabaseConnection } from '../database/types';
import { getDatabaseConnection } from '../database/database';
import { PlayerRepository } from '../repositories/playerRepository';
import { RoundRepository } from '../repositories/roundRepository';
import { GroupRepository } from '../repositories/groupRepository';
import { ScoreRepository } from '../repositories/scoreRepository';
import { ReportRepository } from '../repositories/reportRepository';
import { BackupRepository } from '../repositories/backupRepository';

export class QuizService {
  public players: PlayerRepository;
  public rounds: RoundRepository;
  public groups: GroupRepository;
  public scores: ScoreRepository;
  public reports: ReportRepository;
  public backup: BackupRepository;
  public db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
    this.players = new PlayerRepository(db);
    this.rounds = new RoundRepository(db);
    this.groups = new GroupRepository(db);
    this.scores = new ScoreRepository(db);
    this.reports = new ReportRepository(db);
    this.backup = new BackupRepository(db);
  }
}

let serviceInstance: QuizService | null = null;

export async function getQuizService(): Promise<QuizService> {
  if (!serviceInstance) {
    const db = await getDatabaseConnection();
    serviceInstance = new QuizService(db);
  }
  return serviceInstance;
}

export function createQuizServiceWithDb(db: IDatabaseConnection): QuizService {
  return new QuizService(db);
}
