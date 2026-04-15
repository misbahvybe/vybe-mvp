import { Get, Param, Query, Controller, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    // If GPS coords are provided, apply radius filtering (customer).
    if (latitude != null && longitude != null && String(latitude).trim() !== '' && String(longitude).trim() !== '') {
      return this.stores.listApprovedNear(category, latitude, longitude);
    }
    return this.stores.listApproved(category);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.stores.getById(id);
  }

  /** Search within a store's catalog (restaurant or pharmacy). */
  @Get(':id/search-items')
  async searchItems(
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.stores.searchItemsInStore(id, q, take);
  }
}
