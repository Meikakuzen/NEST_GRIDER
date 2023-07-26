# 01 NEST TypeORM

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
-----------

## TypeORM Decorators

- user.entity

~~~js
