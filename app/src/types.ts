export interface LiveMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'done' | 'error';
}
