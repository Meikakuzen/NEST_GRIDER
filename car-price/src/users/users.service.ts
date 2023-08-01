import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User> 
  ){}

  async create(email: string, password: string) {
    const user = this.userRepository.create({email, password})

    return await this.userRepository.save(user)
  }
 
  async findOne(id: number) {
    if(!id) return null

    const user = await this.userRepository.findOneBy({id});
    if(!user){
      throw new NotFoundException(`User with id ${id} not found`)
    }
    return user
  }
  
  async find(email: string){
    const user = await this.userRepository.find({where: {email}})

    return user
  }
  

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id)


    Object.assign(user, updateUserDto)

    return await this.userRepository.save(user)
  }

  async remove(id: number) {
   const user = await this.findOne(id)
   
    return await this.userRepository.remove(user)
  }
}
