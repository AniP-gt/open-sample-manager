export type Collection = {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly sample_count: number;
};
