import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListProductsQuery } from './dto/list-products.query';

// Public catalog endpoints (read-only). Serve products/categories to the
// customer storefront / landing experience. Auth is not required for browsing.
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('suggest')
  suggest(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.catalog.suggest(q, limit ? Number(limit) : undefined);
  }

  @Get('products')
  products(@Query() query: ListProductsQuery) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:identifier')
  product(@Param('identifier') identifier: string) {
    return this.catalog.getProductByIdentifier(identifier);
  }
}
