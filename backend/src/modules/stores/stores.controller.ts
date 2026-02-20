import { Get, Param, Query, Controller, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  async list(@Query('category') category?: string) {
    return this.stores.listApproved(category);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.stores.getById(id);
  }
}
