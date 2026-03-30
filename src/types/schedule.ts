export type RosterKind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "ATDO"
  | "ADO"
  | "YYC"
  | "YVC"
  | "RESERVE"
  | "BLANK"
  | "RDO"
  | "ALM"
  | "ALV"
  | "HM_STBY"
  | "AP_STBY"
  | "RCRM"
  | "JCRM"
  | "EMER"
  | "TRAINING"
  | "OTHER";

export type ScheduleEvent = {
  id: string;
  owner: "HAN" | "KYU";
  start: string;
  end: string;
  title: string;
  kind?: RosterKind;
  allDay?: boolean;
};