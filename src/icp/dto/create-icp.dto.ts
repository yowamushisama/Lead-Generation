import { ICPConfig } from '../../common/types/icp.types';

export interface CreateICPDto {
  name: string;
  config: ICPConfig;
}
