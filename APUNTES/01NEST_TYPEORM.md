# 01 NEST TypeORM GRIDER

- Proyecto
  
> nest new car-pricing

- Módulo (--no-spec para que no instale los archivos de testing)
  
> nest g res users --no-spec
> nest g res reports --no-spec

- Conexión TypeORM

> npm i @nestjs/typeorm typeorm sqlite3

- En app.module importo TypeOrmModule de @nestjs/typeorm
- Uso .forRoot y le paso el tipo (sqlite), el nombre de la db, las entities, y el synchronize en true

## NOTA: algunas importaciones obvias se omitirán para ahorrar espacio

~~~js
import {TypeOrmModule} from "@nestjs/typeorm"

@Module({
  imports: [UsersModule, ReportsModule, TypeOrmModule.forRoot({
    type: 'sqlite',
    database: 'db.sqlite',
    entities: [],
    synchronize: true
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
~~~

- Levanto el servidor

> npm run start:dev

- Si no tengo errores me crea el archivo db.sqlite 
------

# Entity y Repository

- Para la entidad importo 3 decoradores de typeorm
  - **@Entity**, **@Column**, **@PrimaryGeneratedColumn**
- De propiedades tengo el id, mail y password

~~~js
import { Entity, Column, PrimaryGeneratedColumn  } from "typeorm";

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    email: string

    @Column()
    password: string
}
~~~

- Para conectar la entity voy a users.module e importo el TypeOrmModule y la entity User
- Esta vez uso el .forFeature. Dentro le paso un array con la entity

~~~js
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService]
})
export class UsersModule {}
~~~

- Falta el tercer paso que es conectar la entity a la root connection en app.module
- Importo la entity User en app.module, la añado al array de entities dentro del modulo TypeOrmModule

~~~js
import { User } from './users/entities/user.entity';

@Module({
  imports: [UsersModule, ReportsModule, TypeOrmModule.forRoot({
    type: 'sqlite',
    database: 'db.sqlite',
    entities: [User],
    synchronize: true
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
~~~
-------

- Hago el mismo proceso con la entity reports
- Creo la entidad con esos 3 decoradores

~~~js
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Report {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    price: number

}
~~~

- En reports.module uso el **.forFeature** y como argumento le paso un array con la entidad Report
- En app.module importo la entidad Report y la añado al array de entities del **.forRoot TypeOrmModule**
- El mismo proceso anterior pero con la entity Report
- Instalo la extension de SQLite para visualizar la data en el archivo sqlite dentro del editor
- Ctr+Shift+P, buscar sqlite:Open database. Seleccionar car-pricing/db.sqlite y aparece en la izquierda de VSCode SQLITE EXPLORER
- En el CRUD vamos a usar create, save (que vale para insert y update), find, findOne, remove (delete)

-----------

## Estructura

```
Method and Route              Body or Query String                Description

POST /auth/signup             Body {email-password}               Create a new user and sign in  

POST /auth/signin             Body {email-password}               Sign in as an existing user  

GET /auth/:id                       --------                      Find a user with given id

GET /auth?email=                    --------                      Find a user with given email

PATCH /auth/:id               Body {email-password}               Update a user with given id

DELETE /auth/:id                    ---------                     Delete user with given id

GET /reports                  QS-make, model, year, mileage,      Get an estimate for the cars value  
                                  longitude, latitude

POST /reports                 Body{make, model, year, mileage,    Report how much a vehicle sold for  (update)
                                  longitude, latitude, price}

PATCH /reports/:id           Body {approved}                     Approve or reject a report submitted by user
```
---------

## Body Validation

- Vamos con el método create del controller createUser
- En el decorador le añado la ruta auth **@Controller('auth')**
- Le añado la ruta 'signup' al decorador **@POST('/signup')**
- Para **hacer la validación del dto** debo importar **ValidationPipe** de @nestjs/common en el **main.ts**
  - Le agrego dentro del objeto el whitelist en true

~~~js
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true
    })
  )
  await app.listen(3000);
}
bootstrap();
~~~

- Creo el dto create-user.dto
- Para tener los decoradores para hacer las validaciones debo instalar los paquetes

> npm i class-validator class-transformer

~~~js
import { IsEmail, IsString, MinLength } from "class-validator"

export class CreateUserDto {

    @IsEmail()
    email: string

    @IsString()
    @MinLength(6)
    password: string
}
~~~

- Uso el decorador **@Body** para extraer el body en el controller
- Notar que en el constructor está el servicio **userService** inyectado
- users.controller

~~~js
import { CreateUserDto } from './dto/create-user.dto';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
~~~
-------

## Creando y salvando un usuario

- En el users.service importo **@Repository** de 'typeorm' y **@InjectRepository** de @nestjs/typeorm
- Importo la entidad **User**
- Inyecto el repositorio en el constructor
- Notar que el servicio tiene el decorador **@Injectable**

~~~js
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User> 
  ){}

  create(createUserDto: CreateUserDto) {
    
    const user = this.userRepository.create(createUserDto)

    return this.userRepository.save(user)
  }
}
~~~

- El método create crea la instancia pero es el método save el que guarda la data
- Uso el método POST y añado en el body el email y el password
------

## Hooks de TypeORM

- Puedo usar **AfterInsert** para ejecutar una función después de realizar una inserción con la entity **User**
- También tengo los hooks **AfterRemove** y **AfterUpdate**

~~~js
import { AfterInsert, AfterRemove, AfterUpdate, Entity, Column, PrimaryGeneratedColumn  } from "typeorm";

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    email: string

    @Column()
    password: string

    @AfterInsert()
    logInsert(){
        console.log('Inserted user with id', this.id)
    }

    @AfterRemove()
    logRemove(){
        console.log('Deleted user with id', this.id)
    }

    @AfterUpdate()
    logUpdate(){
        console.log('Updated user with id', this.id)
    }
}
~~~

- Los métodos find y findOne del usersService

~~~js
async findOne(id: number) {
  const user = await this.userRepository.findOneBy({id});
  if(!user){
    throw new NotFoundException(`User with id ${id} not found`)
  }
  return user
}

async find(email: string){
  return await this.userRepository.find({where: {email}})

  //aqui no me sirve la validación con el if
  //si no encuentra el user devuelve un status 200 y un array vacío
  
}
~~~
- Si quiero encontrar por mail tengo que apuntar a http://localhost:3000/auth?email=correo@gmail.com con GET
- Si envío un email que no existe me da un status 200 y me devuelve un array vacío
- Para el update, el update-user dto ya lleva el Partial, por lo que las propiedades que le pase son opcionales

~~~js
async update(id: number, updateUserDto: UpdateUserDto) {
  const user = await this.findOne(id)


  Object.assign(user, updateUserDto)

  return await this.userRepository.save(user)
}
~~~

- El delete ( que es un remove, si fuera delete sería para una propiedad en concreto)

~~~js
async remove(id: number) {
  const user = await this.findOne(id)
  
  return await this.userRepository.remove(user)
}
~~~

- Vamos con el controller a hacer los endpoints!!

~~~js
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query('email') email: string) {
    return this.usersService.find(email);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
~~~
