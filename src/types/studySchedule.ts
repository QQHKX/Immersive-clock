export interface StudyPeriod {
  id: string;
  startTime: string;
  endTime: string;
  name: string;
}

export const DEFAULT_SCHEDULE: StudyPeriod[] = [
  {
    id: "1",
    startTime: "19:10",
    endTime: "20:20",
    name: "第1节自习",
  },
  {
    id: "2",
    startTime: "20:30",
    endTime: "22:20",
    name: "第2节自习",
  },
];
