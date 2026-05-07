export interface Match {
  id: string;
  startTime: string; // ISO 8601 string
  state: string; // "unstarted", "completed", "inProgress"
  type: string;
  blockName: string;
  league: {
    name: string;
    slug: string;
  };
  match: {
    id: string;
    teams: {
      name: string;
      code: string;
      image: string;
      result: {
        outcome: string; // "win", "loss", null
        gameWins: number;
      };
      record: {
        wins: number;
        losses: number;
      };
    }[];
    strategy: {
      type: string;
      count: number;
    };
  };
}

export interface ScheduleData {
  schedule: {
    events: Match[];
  };
}
