import { IntersectionType } from '@nestjs/swagger';
import { LeadFilterDto } from './lead-filter.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class LeadQueryDto extends IntersectionType(LeadFilterDto, PaginationDto) {}
