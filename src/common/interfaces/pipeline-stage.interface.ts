import { TenantContext } from './tenant-context.interface';

export interface IPipelineStage<TInput, TOutput> {
  readonly stageName: string;
  process(input: TInput, context: TenantContext): Promise<TOutput>;
}
