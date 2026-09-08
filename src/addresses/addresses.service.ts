import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto, UpdateAddressDto } from './dto/addresses.dto';

const ADDRESS_ORDER = { updatedAt: 'desc' as const };

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, ADDRESS_ORDER],
    });
    return rows.map(toDto);
  }

  async create(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    const makeDefault = dto.isDefault === true || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      const addr = await tx.address.create({
        data: {
          userId,
          type: dto.type ?? 'HOME',
          label: dto.label || undefined,
          line1: dto.line1,
          line2: dto.line2 || undefined,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country || 'India',
          isDefault: makeDefault,
        },
      });
      return toDto(addr);
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Address not found');

    const isOwnedDefault = dto.isDefault === true;
    return this.prisma.$transaction(async (tx) => {
      if (isOwnedDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      const addr = await tx.address.update({
        where: { id },
        data: {
          type: dto.type,
          label: dto.label,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country,
          isDefault: isOwnedDefault ? true : undefined,
        },
      });
      return toDto(addr);
    });
  }

  async remove(userId: string, id: string): Promise<{ removed: boolean }> {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Address not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      // if we removed the default, promote the newest remaining to default
      if (existing.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { removed: true };
  }
}

function toDto(a: {
  id: string; type: string; label?: string | null; line1: string; line2?: string | null;
  city: string; state: string; pincode: string; country: string; isDefault: boolean;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: a.id,
    type: a.type,
    label: a.label ?? null,
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
