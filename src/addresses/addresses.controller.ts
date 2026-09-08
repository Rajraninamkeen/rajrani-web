import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { AddressDto, UpdateAddressDto } from './dto/addresses.dto';

// CUSTOMER address book. The Address table has existed since foundation but had no
// API; this controller exposes it (CRUD + default handling) for the storefront.
@Controller('addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.addresses.list(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: AddressDto) {
    return this.addresses.create(userId, dto);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.addresses.remove(userId, id);
  }
}
