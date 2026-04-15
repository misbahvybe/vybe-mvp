import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Global search across stores + products (restaurants/pharmacies). */
  @Get('global')
  async global(
    @Query('q') q?: string,
    @Query('takeStores') takeStores?: string,
    @Query('takeItems') takeItems?: string,
  ) {
    return this.search.global(q, {
      takeStores: Number(takeStores ?? 12),
      takeItems: Number(takeItems ?? 20),
    });
  }
}

