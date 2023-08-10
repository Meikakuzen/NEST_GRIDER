# 07 NEST BASIC PERMISSION SYSTEM

- Vamos a implementar la idea de aprovar o rechazar un report posteado por un user
- Será un PATCH /reports/:id con un body donde esté el aprovado o no
- Por defecto el report estará no-aprobado
- Solo admin podrá aprobar o rechazar los reports
- Agrego la propiedad a la entity
- report.entity

~~~js
@Column({default: false})
    approved: boolean
~~~

- Añado a ReportsDto la propiedad approved

~~~js
@Expose()
approved: boolean
~~~

- En el controller necesito extraer el id y cambiar a true el approved que hay en el body

~~~js
@Patch('/:id')
approveReport(@Param('id') id: string, @Body() body: ApprovedReportDto) {
return this.reportsService.changeApproval(+id, body.approved);
}
~~~

- Creo el Dto

~~~js
import { IsBoolean } from "class-validator";

export class ApprovedReportDto{

    @IsBoolean()
    approved: boolean
}
~~~

- En el servicio, para encontrar el report uso async await
- Compruebo que el repo existe

~~~js
  async changeApproval(id: number, approved: boolean) {

    const report = await this.repo.findOneBy({id})

    if(!report) throw new NotFoundException('Report not found')

    report.approved = approved
    return this.repo.save(report)
  }
~~~

- Puedo comprobar que funciona con ThunderClient con PATCH /reports/id_del_report y pasarle approved: true en el body
- Falta implementar de que solo el admin pueda aprobar estos reports
-----

## Authorization vs Authentication

- Authentication == saber quien está haciendo la request
- Authorization == saber si la persona que está haciendo la request está autorizada para ello 
- Con CurrentUserInterceptor, con su método intercept extraemos el userId de la cookie y sabemos qué user y lo guardamos en la request con la variable request.currentUser
- Entonces, dispongo del user en la request
- current-user-interceptor.ts

~~~js
import { NestInterceptor, ExecutionContext, CallHandler, Injectable } from "@nestjs/common";
import { UsersService } from "../users.service";

@Injectable()
export class CurrentUserInterceptor implements NestInterceptor{

    constructor(private usersService: UsersService){}

    async intercept(ctx: ExecutionContext, handler: CallHandler){
        
        const request = ctx.switchToHttp().getRequest()

        const {userId} = request.session || {} 

        if(userId){
            const user= await this.usersService.findOne(userId) 
           
            request.currentUser = user
        }

        return handler.handle() 
    }
}
~~~

- Vamos a incorporar un **AdminGuard** donde vamos a preguntar si request.currentUser es admin
- Si es admin retornará true lo que dará acceso a la ruta
- En lugar de roles podemos manejar admin **con un boolean**
-----

## Adding an Authorization Guard

- En user.entity le añado la propiedad admin como boolean

~~~js
@Column({default: false})
admin: boolean
~~~

- Le pongo el default en **true** para propósitos de **testing**
- Creo en /src/guards/admin.guard.ts
- Será muy similar a auth.guard
- Importo **CanActivate** y **ExecutionContext** de '@nestjs/common'
- CanActivate implica emplear **el método canActivate** y ExecutionContext **contiene la request**
- Recuerda que CurrentUserInterceptor guarda el user en la request, dentro de currentUser
- Valido si está definido el user
- Retornando request.currentUser.admin si existe dará true, si no false
  - **Los Guards trabajan con valores truthly o falsy**

~~~js
import {CanActivate, ExecutionContext} from '@nestjs/common'

export class AdminGuard implements CanActivate{

    canActivate(context: ExecutionContext){
        const request = context.switchToHttp().getRequest()

        if(!request.currentUser) return false

        return request.currentUser.admin        
    }
}
~~~
----

## Algo no funciona

- En reports.controller importo **AdminGuard** y **UseGuards**

~~~js
@Patch('/:id')
@UseGuards(AdminGuard)
approveReport(@Param('id') id: string, @Body() body: ApprovedReportDto) {
return this.reportsService.changeApproval(+id, body.approved);
}
~~~

- Para probar creo un nuevo usuario que será admin
- Pero cuando uso el endpoint PATCH para aprobar un report recibo un error 403 "Forbidden resource"
- **ERROR!**
-------

## Middlewares, Guards, and Interceptors

- Request --> Middlewares ---> Guards --> Interceptor ---> RequestHandler ---> Interceptor ---> Response
- En el middleware tengo el cookie-session midleware que coloca el user en el objeto session
- El problema está en que **AdminGuard se ejecuta antes que el CurrentUserInterceptor** que me dice que usuario es
- Se soluciona **transformando el CurrentUserInterceptor en un middleware**
- Cogeremos el current-user.interceptor y lo transformaremos en un middleware global como hicimos con cookieSession
- Creo /src/users/middlewares/cuurent-user.middleware.ts
- Importo
  - **Injectable, NestMiddleware** de @nestjs/common
  - **Request, Response, NextFunction** de express
  - **UsersService**
- Al **implementar NestMidlleware** en la clase **debemos usar** el método **use** que **puede ser async**
- Necesito tener acceso al UsersService, por lo que **lo inyecto usando el decorador @Injectable en la clase**

~~~js
import {Injectable, NestMiddleware} from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { UsersService } from '../users.service'

@Injectable()
export class CurrentUserMiddleware implements NestMiddleware{
    constructor(private usersService: UsersService){}

    async use(req: any, res: any, next: NextFunction) {
        const { userId } = req.session || {} 

        if(userId){
            const user = await this.usersService.findOne(userId)
            req.currentUser = user
        }
        next()
    }
}
~~~

- Para **configurarlo globalmente**, llamo a la función **configure** en AppModule
- Recuerda que **cookieSession solo se puede importar con require**

~~~js
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import {TypeOrmModule} from "@nestjs/typeorm"
import { User } from './users/entities/user.entity';
import { Report } from './reports/entities/report.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
const cookieSession = require('cookie-session');

@Module({
  imports: [UsersModule, ReportsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService)=>{
        return {
          type: 'sqlite',
          database: config.get<string>('DB_NAME'),
          entities: [User, Report],
          synchronize: true 
          }
      }
  })],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer){
    consumer
      .apply(
        cookieSession({
          keys:['lelele']
        }),
      )
      .forRoutes('*')
  }
}
~~~

- Hay que hacer lo mismo en UsersModule
- Importo **CurrentUserMiddleware** y también **MiddlewareConsumer** de @nestjs/common
- uso el configure igual, para todas las rutas
- Puedo borrar el objeto de interceptor

~~~js
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
//import { CurrentUserInterceptor } from './interceptors/current-user.interceptor';
//import {APP_INTERCEPTOR} from '@nestjs/core'
import { CurrentUserMiddleware } from './middlewares/current-user.middleware';

@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService, 
    AuthService, 
    //{ provide: APP_INTERCEPTOR,
     // useClass: CurrentUserInterceptor}
    ]
})
export class UsersModule {
  configure(consumer: MiddlewareConsumer){
    consumer
      .apply(CurrentUserMiddleware).forRoutes('*')
  }
}
~~~

## Nota: si req.currentUser diera error de tipado  puedo decirle a express que la request puede tener currentUser de tipo User

~~~js
declare global{
  namespace Express{
    interface Request{
      currentUser?: User
    }
  }
}

//lo añado fuera  de la clase CurrentUserMiddleware
~~~
-----

## Validating Query String Values

- GET /reports tiene en su query strings make, model, year, mileage, longitude, latitude y devuelve el valor estimado del coche
- Necesitamos validar esta información con un dto como hacemos con el body
- Creo en /reports/dto/get-estimated.dto.ts
- No incluyo el precio en el dto porque eso es lo que estoy buscando 

~~~js
import { IsLatitude, IsLongitude, IsNumber, IsString, Max, Min } from "class-validator"

export class GetEstimateDto{

    @IsString()
    make: string

    @IsString()
    model: string


    @IsLatitude()
    @Min(0)
    lat: number

    @IsLongitude()
    @Min(0)
    lng: number

    @IsNumber()
    @Min(0)
    @Max(1000000)
    mileage: number
    
    @IsNumber()
    @Min(1939)
    @Max(2050)
    year:number
}
~~~

- Voy al reports.controller, necesito el decorador Query

~~~js
@Get()
getEstimate(@Query() query: GetEstimateDto) {
  return this.reportsService.getEstimate(query);
}
~~~

- El problema es que cuando voy al endpoint con las query, los query-parameters siempre son strings y el dto espera números

> http://localhost:3000/reports?make=toyota&model=corolla&lat=0&lng=0&mileage=1000&year=1991
-----

## Transforming Query String in Data

- En el get-estimated.dto importo **Transform** de class-transformer
- Lo coloco encima de los otros decoradores
- Desestructuro la propiedad value de la propiedad en si en el callback
- Para longitude y latitude en lugar de ParseInt usaré ParseFloat

~~~js
@Transform(({value})=>parseInt(value))
~~~

~~~js
import { IsLatitude, IsLongitude, IsNumber, IsString, Max, Min } from "class-validator"
import { Transform } from "class-transformer"

export class GetEstimateDto{

    @IsString()
    make: string

    @IsString()
    model: string


    @Transform(({value})=>parseFloat(value))
    @IsLatitude()
    @Min(0)
    lat: number

    @Transform(({value})=>parseFloat(value))
    @IsLongitude()
    @Min(0)
    lng: number

    @Transform(({value})=>parseInt(value))
    @IsNumber()
    @Min(0)
    @Max(1000000)
    mileage: number
    
    @Transform(({value})=>parseInt(value))
    @IsNumber()
    @Min(1939)
    @Max(2050)
    year:number
}
~~~

- Ahora no obtengo errores de validación
------

## How will we generate the estimate

- Para generar el valor estimado, se buscarán los mismos modelos y marcas
- Se buscará ne la misma latitude y langitude con una variabilidad de 5 grados
- Según el año se buscará en un rango de 3 años
- Se ordenará según el que menos kilometraje tenga y se mostrarán los 3 resultados más cercanos
- No es una SUPER LÓGICA, pero servirá para ver los **Query Builders**
------

## Creating a Query Builder

- Podemos usar find y findOne como filtro sobre los reports
- Hay varios pasos descritos anteriormente que quiero hacer con la query
- Para eso usaré createQueryBuiler en el servicio
- reports.controller

~~~js
@Get()
getEstimate(@Query() query: GetEstimateDto) {
  return this.reportsService.createEstimate(query);
}
~~~

- Vamos con el createQueryBuilder
- Con select asterisco elijo todos los registros
- En el where hago el filtrado, le digo que el valor make será igual a un valor make que yo le voy a indicar y se lo paso en un objeto
- Con getRawMany obtengo el resultado
- **NOTA**: Podría desestructurar las propiedades con createEstimate({make, model,lng,lat}) pero lo hago así para que quede más claro
- reports.service

~~~js
  createEstimate(estimateDto: GetEstimateDto) {
    return this.repo.createQueryBuilder()
    .select('*') //selecciono todo
    .where('make = :make', {make: estimateDto.make} )  //filtro el resultado
    .getRawMany() //obtengo el resultado
  }
~~~

- Si volviera a escribir otro .where sobreescribiría el anterior
- Para encadenar where uso andWhere
- Para hacer el rango de 5º de lng y lat uso BETWEEN
- Para ordenar por kilometraje le resto el mileage dado a la propiedad mileage
  - Si le pudeo indicar el orden en valores descendientes con DESC. Uso ABS para obtener el valor absoluto y no me de un posible valor negativo
  - OrderBy no me permite pasarle en un objeto mileage, uso setParameters
  - Para obtener solo 3 resultados uso limit(3)
  - En el select, en lugar de buscar con * uso AVG(de average, promedio, del precio de los 3 resultados) y le paso el precio como string
  - En lugar de getRawMany uso getRawOne

~~~js
createEstimate({make, model, lat, lng, year, mileage}) {
  return this.repo.createQueryBuilder()
                  .select('AVG(price)', 'price') 
                  .where('make = :make', {make} )  
                  .andWhere('model = :model', {model})
                  .andWhere('lat - :lat BETWEEN -5 AND 5', {lat})
                  .andWhere('lng - :lng BETWEEN -5 AND 5', {lng})
                  .andWhere('year - :year BETWEEN -3 AND 3', {year})
                  .orderBy('ABS(mileage -:mileage)', 'DESC' )
                  .setParameters({mileage})
                  .limit(3)
                  .getRawOne() 
}
~~~

- Para probar esta logica debo crear algunos reports con la misma marca y modelo
- Si creo 3 modelos SET Panda enntre los años 1990-1995 y apunto a este endpoint me da un precio promedio

> http://localhost:3000/reports?make=Seat&model=Panda&lat=0&lng=0&mileage=1000&year=1991

- Ahora falta añadir que los reports estén aprovados para poder contar con ellos
- Uso andWhere en el queryBuilder

> .andWhere('approved IS TRUE')

- Si no hay resultados devuelve null
