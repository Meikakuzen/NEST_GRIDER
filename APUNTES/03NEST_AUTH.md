# 03NEST AUTH GRIDER

## Authentication Overview

- /auth/signup y /auth/signin van a usar autenticación
- Pongamos que para el resto de rutas no es necesario autenticación
- Con el signup hay que verificar si el correo está en uso (en ese caso devolver un error)
  - Encriptar el password
  - Guardar el usuario en la db
  - Devolver una cookie que contiene el user id
    - El browser automáticamente almacena la cookie y la adjudica a siguientes requests
- Cuando voy a POST /reports está la cookie userId=34 con info en un objeto
  - Compruebo la data en la cookie
  - Miro el userId para saber quien está haciendo la request
    - Que el usuario que hace la request sea el mismo que el que ha ingresado
- Hay que añadir dos nuevos métodos en el servicio: signup y signin
- Para ello podemos crear un nuevo servicio llamado Auth Service que interactue con Users Service
- Para una aplicación pequeña quizá no fuera necesario, pero a medida que crezca y necesite otros métodos como resetear el password, establecer preferencias, etc. si será necesario tener su propio servicio de auth
-----

## Reminder on Service Setup

- Haciendo un pequeño diagrama de dependencias
  - Users Controller va a usar Users Service y Auth Service
  - Auth Service va a usar Users Service
  - Users Service va a usar Users Repository
- Para hacer la inyección de dependencias se utiliza el constructor, y se añade el servicio a la lista de prviders en el módulo
- Creo el servicio dentro de /users/auth.service.ts
- Importo **@Injectable**  de @nestjs/common como decorador de la clase
- Importo **UsersService** y lo inyecto

~~~js
import { Injectable } from "@nestjs/common";
import { UsersService } from "./users.service";

@Injectable()
export class AuthService{
    constructor(
        private usersService: UsersService
    ){}
}
~~~

- Lo añado a la lista de providers en users.module.ts

~~~js
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';

@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AuthService]
})
export class UsersModule {}
~~~

- Habrá que inyectar el AuthService en el controller
-------

## Implementing Signup Functionality

- En signup compruebo si el email está en uso
- Uso .length para hacer la verificación por que devuelve un array de la promesa
- Encripto el password, importo randomBytes (para generar el salt) y scrypt (para hashear, lo renombro a _scrypt para codificarlo como promesa) del paquete 'crypto'
  - scrypt es de naturaleza asincrona, para evitar trabajar con callbacks usaremos promisify del paquete 'util'
  - Typescript no tiene idea de cual es el valor de retorno de scrypt cuando uso promisify
  - Para generar el salt, randomBytes me devuelve un buffer (similar a un array con unos y ceros), con toString('hex') lo transformo a un string hexadecimal (16 caracteres de letras y numeros)
  - Creo el hash, le paso el password, el salt, y 32 son los bytes de salida (standard), pueden ser más
  - Si miro el tipo de retorno de hash, Typescript dice unknown, no tiene ni idea
  - Lo meto entre paréntesis y le digo a Typescript que es un Buffer
  - Junto el salt y el hash separados por un punto
- Creo un nuevo usuario, lo guardo y lo retorno

~~~js
import { BadRequestException, Injectable } from "@nestjs/common";
import { UsersService } from "./users.service";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt)

@Injectable()
export class AuthService{
    constructor(
        private usersService: UsersService
    ){}

    async signup(email: string, password: string){
        const users = await this.usersService.find(email)

        if(users.length) throw new BadRequestException('email in use')

        const salt = randomBytes(8).toString('hex')

        const hash = (await scrypt(password, salt, 32 )) as Buffer

        const result = salt + '.' + hash.toString('hex')

        const user = await this.usersService.create(email, result)

        return user
    }

    signin(){}
}
~~~

- Importo el AuthService en el controller, lo inyecto
- En el POST, en lugar de usar usersService uso authService y le paso el email y el password
 
~~~js
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { AuthService } from './auth.service';

@Controller('auth')
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService,
              private readonly authService: AuthService) {}

  @Post('/signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto.email, createUserDto.password)
  }

  (...)
}
~~~

- Pequeña modificación en el método create del UsersService

~~~js
async create(email: string, password: string) {
  const user = this.userRepository.create({email, password})

  return await this.userRepository.save(user)
}
~~~

- Si ahora hago ctrl+shift+p SQLite: Open Data Base, car-price,  puedo observar que el password está encriptado
- Para el signin es similar. Recibo un email y un password, debo encontrar ese usuario y si no devolver un error
- Mirar si el password hace match, etc
------

## Handling User Sign In

- En usersService tengo findOne que requiere el id
- find requiere el email, pero puede devolver varios users, por lo que devuelve un array
- Uso desestructuración de asrrays para extraer un usuario
- Verifico que existe el usuario
- Tengo el password dividido por un punto del salt y el hash. Uso split y desestructuración para obtenerlos
- Creo de la misma manera el hash con el salt, y hago la comparación de los hashes

~~~js
async signin(email: string, password: string){
    const [user] = await this.usersService.find(email)

    if(!user) throw new NotFoundException('user not found')

    const [salt, storedHash] = user.password.split('.')

    const hash = (await scrypt(password, salt, 32)) as Buffer

    if(storedHash !== hash.toString('hex')){
        throw new BadRequestException('bad password')
    }
      return user
}
~~~

- Creo otro handler POST en el users.controller para el signin
- Uso el mismo dto de createUserDto, ya que necesito el email y el password

~~~js
@Controller('auth')
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService,
              private readonly authService: AuthService) {}

  @Post('/signup')
  createUser(@Body() body: CreateUserDto) {
    return this.authService.signup(body.email, body.password)
  }

  @Post('/signin')
  signIn(@Body() body: CreateUserDto){
    return this.authService.signin(body.email, body.password)
  }
}
~~~

- Si coloco el email y password correctos me devuelve el id y el email del usuario
- Vamos con el tema de la Cookie-Session para almacenar el id
-------

## Setting up Sessions

- Vamos a enviar un header llamado Cookie con un string que luce como varias letras y números random
- La librería Cookie-Session mira el header de la cookie, que contiene el string encriptado
- Cookie-Sessions decodifica el string resultando en un objeto (Session Object)
- Tenemos acceso al objeto en el handler usando un decorador
- Podemos añadir, remover, cambiar propiedades en el objeto
- Cookie-Session ve la sesión actualizada y lo vuelve a una string encriptada
- El string encriptado (que incluye la actualización del objeto) es devuelto en la Set-Cookie de los headers en la response  
- Instalo la librería

> npm i cookie-session @types/cookie-session

- En el main debo configurar el cookie middleware
- No acepta el import del ECMAS6 por lo que se usa require
- Hago uso de app.use y dentro del objeto de cookieSession le paso la propiedad keys con un array de un string
- Este string se usará para encriptar la información de la cookie. Más adelante se configurará como una variable de entorno
- main.ts

~~~js
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
const cookieSession = require('cookie-session');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieSession({
    keys:['lalala']
  }))
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true
    })
  )
  await app.listen(3000);
}
bootstrap();
~~~
-----

## Changing and Fetching Session Data

- El decorador Session funciona con la librería Cookie-Session 
- Me permitirá acceder al objeto de la cookie
- Ejemplo, dónde actualizaría el color del objeto Session en la cookie y otro handler donde retorno el color almacenado en la cookie

~~~js
@Get('/colors/:color')
setColor(@Param('color') color: string, @Session() session: any){
  session.color = color
}

@Get('/colors')
getColors(@Session() session: any){
  return session.color
}
~~~
----

## Signin in a User

- Dentro del signup y signin vamos a extraer el id y almacenarlo como userId en la cookie
- En el handler del controller uso **@Session** para extraer la session. Lo tipo como any de momento
- Vuelvo los handlers async, remuevo el return del servicio para guardar el resultado en una variable user
- Ahora puedo colocar el user.id en la session

~~~js
@Post('/signup')
async createUser(@Body() body: CreateUserDto, @Session() session: any) {
  const user = await this.authService.signup(body.email, body.password)
  session.userId = user.id
  return user
}

@Post('/signin')
async signIn(@Body() body: CreateUserDto, @Session() session: any){
  const user = await this.authService.signin(body.email, body.password)
  session.userId = user.id
  return user
}
~~~
------

## Getting the Current User

- Creo un nuevo handler en users.controller de tipo GET con el endpoint whoami

~~~js
@Get('/whoami')
whoAmI(@Session() session: any){
  return this.usersService.findOne(session.userId)
}
~~~
-----

## Signing Out a User

- Creo otro handler POST para el signout

~~~js
@Post('/signout')
signOut(@Session() session: any){
  session.userId = null
}
~~~

- De esta manera el método findOne de whoami (al recibir null) no actúa de la manera esperada
- Vamos a retocar el método findOne para que en el caso de recibir null actúe adecuadamente

~~~js
async findOne(id: number) {
    if(!id) return null
    
    const user = await this.userRepository.findOneBy({id});
    if(!user){
      throw new NotFoundException(`User with id ${id} not found`)
    }
    return user
  }
~~~

- Si hago el POST signout, al hacer el GET whoami me devuelve un 200 pero no retorna nada
-----

## Two Automation Tools

- Relacionado con el handler signIn, ciertos handlers deben rechazar la request si el usuario no ha ingresado en el sistema
  - Para este caso usaremos un **Guard**. Protege la ruta del acceso si no se está autenticado
- signOut automaticamente debería decirle al handler quien hay ingresado en el sistema 
  - Para este caso usaremos un **Interceptor + Decorator**. Es más complicado por lo que empezaremos por este
------

## Custom Param Decorators

- Quiero crear un **Custom Decorator** para extraer el user sin usar @Session y todo el rollo
- Creo en users/decorators/current-user.decorator.ts
- Importo de @nestjs/common:
  - createParamDecorator
  - ExecutionContext
- Esqueleto de mi Custom Decorator
 
~~~js
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser =  createParamDecorator(
    (data: any, ctx: ExecutionContext)=>{

    }
)
~~~

- Necesito también un interceptor. Porqué?
- Lo que sea que le pase al decorador @CurrentUser('aksdakds') en el handler, va a estar disponible en el parámetro data:any de la función que hay dentro del CurrentUser
- Como mi decorador no necesita ningún parámetro, pongo que data será de tipo never.
- Esto marcará error si le pongo algún parámetro al decorador
- En el Custom Decorator necesito el objeto session y el usersService
- Para extraer el id uso el ctx: ExecutionContext, para esto no hay problema
- Cuando se complica es cuando quiero usar el servicio para encontrar al usuario por el id
- UsersService es inyectable y a la vez usa el userRepository que también es inyectable

~~~js
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser =  createParamDecorator(
    (data: never, ctx: ExecutionContext)=>{
        
        const request = ctx.switchToHttp().getRequest()

        const id = request.session.userId

        return id // Si lo que quisiera es retornar el id podría hacerlo así
    }
)
~~~

- No puedo usar el servicio. Los Param Decorators viven fuera del sistema de inyección de dependencias  
- No puedo usar directamente UsersService
- **El Interceptor va a resolver este problema**
- Creo un interceptor que reciba el id para que interactue con UsersService, obtenga el usuario y retornarlo en el decorador
-------

## Comunicating from Interceptor to Decorator

- Creo users/interceptors/current-user.interceptor.ts
- Importo de @nestjs/common:
  - NestInterceptor
  - ExecutionContext
  - CallHandler
  - Injectable
- Importo el UsersService
- Una vez tengo el usuario, para pasárselo al decorador lo meto en la request

~~~js
import { NestInterceptor, ExecutionContext, CallHandler, Injectable } from "@nestjs/common";
import { UsersService } from "../users.service";

@Injectable()
export class CurrentUserInterceptor implements NestInterceptor{

    constructor(private usersService: UsersService){}

    async intercept(ctx: ExecutionContext, handler: CallHandler){
        
        const request = ctx.switchToHttp().getRequest()

        const {userId} = request.session || {} //puede ser que venga vacío, para que prosiga con el código

        if(userId){
            const user= await this.usersService.findOne(userId) //uso el servicio para encontrar el usuario
            //para comunicarme con el decorador, coloco el user en la request
            request.currentUser = user
        }
        
        return handler.handle() //esto es "sigue adelante y ejecuta el handler"
    }
}
~~~

- Ahora voy al decorador CurrentUser y retorno el user de la request

~~~js
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser =  createParamDecorator(
    (data: never, ctx: ExecutionContext)=>{
        const request = ctx.switchToHttp().getRequest()

        return request.currentUser
    }
)
~~~

- El interceptor que he creado debe correr antes que el decorador
- Puedo implementarlo de dos maneras
- Para usar inyección de dependencias debo declararlo en los providers del módulo

~~~js
@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AuthService, CurrentUserInterceptor]
})
export class UsersModule {}
~~~

- Para usarlo en el users.controller importo UseInterceptors de @nestjs/common
- Lo pongo a nivel de controlador

~~~js
@Controller('auth')
@Serialize(UserDto)
@UseInterceptors(CurrentUserInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService,
              private readonly authService: AuthService) {}

  @Get('/whoami')
  whoAmI(@CurrentUser() user: User){  
    return user
  }
}
~~~

- Para que funcione he tenido que importar CurrentUserInterceptor, UseInterceptors, añadirlo al controlador...
- Si tuviera quince controladores sería mucho código duplicado
- **Hay otra manera**
----------

## Globally Scoped Interceptors

- Aplicaremos el interceptor globalmente
- En users.module importo **APP_INTERCEPTOR** de '@nestjs/core'
- Envuelvo el CurrentUserInterceptor en un objeto y lo coloco dentro de la propiedad useClass
- Le añado el provide: APP_INTERCEPTOR al objeto

~~~js
import { CurrentUserInterceptor } from './interceptors/current-user.interceptor';
import {APP_INTERCEPTOR} from '@nestjs/core'

@Module({
  imports:[TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService, 
    AuthService, 
    { provide: APP_INTERCEPTOR,
      useClass: CurrentUserInterceptor}
    ]
})
export class UsersModule {}
~~~

- Ahora falta trabajar con el sign in y rechazar requests si el usuario no se ha loggeado
---------

## Preventing Access with Authentication Guards

- Los Guards son **una clase** que a través de **canActivate()** devuelve un truthly o falsy value si el usuario puede acceder o no
- Cualquier valor de retorno como null, undefined, etc, retornará un falsy y rechazará la petición automáticamente
- El Guard puede estar a nivel de **aplicación, de controller o de handler**
- Creo en src/guards/auth.guard.ts
- Importo de @nestjs/common
  - CanActivate
  - ExecutionContext
- Implemento la interfaz CanActivate a la clase
- Me pide la función canActivate que puede devolver un boolean, una promesa de tipo boolean, o un Observable de tipo boolean

~~~js
import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Observable } from "rxjs";

export class AuthGuard implements CanActivate{

    canActivate(ctx: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
     const request = ctx.switchToHttp().getRequest()
     
     return request.session.userId
    }
}
~~~

- En users.controller importo el AuthGuard. También el useGuards de @netsjs/common
- Lo uso en un handler

~~~js
@Get('/whoami')
@UseGuards(AuthGuard)
whoAmI(@CurrentUser() user: User){  
  return user
}
~~~

- Si no estoy logeado me devuelve un 403