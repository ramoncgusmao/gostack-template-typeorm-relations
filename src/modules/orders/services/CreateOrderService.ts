import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository') private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) throw new AppError('Usuario nao encontrado');

    const productsBody = await this.productsRepository.findAllById(products);

    if (!productsBody.length)
      throw new AppError('nenhum produto não encontrado');

    const productExistents = productsBody.map(product => product.id);

    const checkProductsExistents = products.filter(
      product => !productExistents.includes(product.id),
    );
    if (checkProductsExistents.length) {
      throw new AppError('existem produtos não encontrados');
    }
    const checkProductsQuantitityInsufficient = products.filter(
      product =>
        product.quantity >
        productsBody.filter(productBody => productBody.id === product.id)[0]
          .quantity,
    );

    if (checkProductsQuantitityInsufficient.length) {
      throw new AppError('não possui produtos suficientes em estoque');
    }
    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsBody.filter(product2 => product2.id === product.id)[0]
        .price,
    }));
    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const productsQuantityAtualized = productsBody.map(product => ({
      id: product.id,
      quantity:
        product.quantity -
        products.filter(product2 => product2.id === product.id)[0].quantity,
    }));
    await this.productsRepository.updateQuantity(productsQuantityAtualized);

    return order;
  }
}

export default CreateOrderService;
