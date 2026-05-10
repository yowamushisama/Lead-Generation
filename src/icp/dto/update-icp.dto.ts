import { ICPConfig } from '../../common/types/icp.types';

export interface UpdateICPDto {
  name?: string;
  config?: Partial<ICPConfig>;
  isActive?: boolean;
}
