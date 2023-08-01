# 02 NEST Custom Data Serialization  GRIDER

- No queremos incluir el password en la respuesta y además debería estar encriptado
- Entonces, debemos asegurarnos que cuando devolvamos un usuario, no devolvamos el password
- Para ello usaremos un **decorador interceptor**, **Class Serializer Interceptor** 
  - devuelve una instancia en un objeto plano basado en algunas reglas
- En la entidad User importo **Exclude de class-transformer**
- Se lo añado a la propiedad password

~~~js
import { AfterInsert, AfterRemove, AfterUpdate, Entity, Column, PrimaryGeneratedColumn  } from "typeorm";
import { Exclude } from "class-transformer";

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    email: string

    @Column()
    @Exclude()   //le añado el decorador Exclude para que no lo devuelva en la respuesta
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

- En el user.controller importo **UseInterceptor** y **ClassSerializerInterceptor** de @nestjs/common
- Lo uso en el findOne

~~~js
@UseInterceptors(ClassSerializerInterceptor)
@Get(':id')
findOne(@Param('id') id: string) {
return this.usersService.findOne(+id);
}
~~~

- Esta solución (recomendada por NEST) quizá no es la mejor
- Si quiero dos endpoints diferentes, y en uno de ellos más info del usuario que en el otro, Exclude no me va a servir
- En lugar de usar el Exclude vamos a crear un **Custom Interceptor** con un **UserDTO** que describa como serializar un User para la ruta en particular
- Habrá otro DTO para serializar otra ruta
-----

## Cómo construir Interceptors

- Los interceptors pueden trabajar con las **requests y/o las responses**
- Son parecidos a los middlewares
- El interceptor se puede aplicar **en un handler** del controller, o también a nivel de la clase @Controller para que **afecte a todos los handlers**, **o globalmente**
- Se crean con **una clase**
- Necesitamos el **context: ExecutionContext** con información de la request y el **next: CallHandler**, que es como una referencia al handler del controller
- Ya podemos sacar el **@Exclude** de la entity User
- Creo en */src/interceptors/serialize.interceptor.ts*, serialize porque va a serializar un objeto a JSON
- Hago los imports de @nestjs/common
  - UseInterceptors
  - NestInterceptor
  - ExecutionContext
  - CallHandler
- También importo Observable de rxjs
- Importo map de rxjs/operators
- Importo plainToInstance de class-transformer
- Uso **implements NestInterceptor** para que cumpla con la interfaz de interceptor de Nest
- Creo el metodo **intercept** al que le paso el ExecutionContext y el CallHandler
  - Devuelve algo de tipo Observabe o una promesa de tipo Observable, de genérico de momento le pongo any

## NOTA: obtengo la información poniendo el cursor encima

- serialize.interceptor.ts

~~~js
import { UseInterceptors, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs";
import { plainToInstance } from "class-transformer";

export class SerializeInterceptor implements NestInterceptor {

    intercept(context:ExecutionContext, next:CallHandler): Observable<any>{


        console.log('Esto va antes del handler del controller', context)

        return next.handle().pipe(
            map((data: any)=>{
            
                console.log('Esto va antes de que la response sea enviada')
                return data
            })
        )
    }
}
~~~

- Dentro de intercept puedo escribir código antes de que sea procesado por el handler del controller
- Dentro del map (dentro del next.handle().pipe()) puedo hacer correr algo antes de que la response sa enviada
- Entonces en el cuerpo de intercept trabajo con la incoming data, y en el callback del map en next.handle().pipe() la outcoming data, para después retornarla 
- Para usar el interceptor lo importo en el controlador y lo uso en el handler findUser
- Para observar los console.logs en orden, coloco un console.log en el handler
  
~~~js
@UseInterceptors(SerializeInterceptor)
@Get(':id')
async findUser(@Param('id') id: string) {
    await this.usersService.findOne(+id);
 }
~~~

- Lo primero imprime esto va antes del handler... luego el ExecutionContext, luego imprime desde el handler y finalmente esto va antes que la response....
------

## Serialization en el Interceptor

- Vamos a usar un dto que describa como serializar (pasar a JSON) a un user en este handler en particular
- Es transformar la instancia de User en un dto, y este dto en un JSON
- Expose sirve para exponer explicitamente esas propiedades
- user.dto.ts

~~~js
import { Expose } from "class-transformer"

export class UserDto{

    @Expose()
    id: number

    @Expose()
    email: string
}
~~~

- Importo el dto en el interceptor
- Luego se hará una refactorización para no hardcodear el dto en el interceptor
- Para transformar la data en el userDto usaré **plainToInstance**
- Le paso el dto, la data y un objeto con excludeExtraneousValues en true, de esta manera solo va a extraer en el JSON las propiedades con el **@Exclude**
- Otras propiedades serán excluidas

~~~js
import { UseInterceptors, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs";
import { plainToInstance } from "class-transformer";
import { UserDto } from "src/users/dto/user.dto";

export class SerializeInterceptor implements NestInterceptor {

    intercept(context:ExecutionContext, next:CallHandler): Observable<any>{

        return next.handle().pipe(
            map((data: any)=>{
            
                return plainToInstance(UserDto, data, {
                    excludeExtraneousValues: true
                })
               
            })
        )
    }
}
~~~

- Ahora si hago una petición a localhost:3000/auth/1 no me devuelve el password en el objeto de retorno
- Vamos a hacer el interceptor más reutilizable, por si queremos extraer fotos, más datos o lo que sea
------

## Customize Interceptor

- Importo el dto en el controller
- Lo que necesito es pasarle en el constructor de SerializeInterceptor el UserDto
- users.controller

~~~js
@UseInterceptors(new SerializeInterceptor(UserDto))
@Get(':id')
async findUser(@Param('id') id: string) {
    await this.usersService.findOne(+id);
}
~~~

- Agrego el constructor en el Interceptor y le paso el dto de tipo any (de momento)

~~~js
export class SerializeInterceptor implements NestInterceptor {

    constructor(private dto:any){}

    intercept(context:ExecutionContext, next:CallHandler): Observable<any>{

        return next.handle().pipe(
            map((data: any)=>{
            
                return plainToInstance(this.dto, data, {
                    excludeExtraneousValues: true
                })             
            })
        )
    }
}
~~~

- En este momento este controller necesita importar @UseInterceptors, SerialInterceptor y UserDto
- Vamos a refactorizarlo para no escribir tanto código
------

## Wrapping the interceptor in a Decorator

- Los **decoradores son simples funciones**
- En el interceptor exporto una función que voy a llamar Serialize
- Dentro voy a retornar exactamente lo que coloqué en el controlador
- Escribo la función **fuera** del interceptor (en la cabecera)
- serialize.interceptor.ts

~~~js
export function Serialize(dto: any){
    return UseInterceptors(new SerializeInterceptor(dto))
}
~~~

- En el users.controller hago uso del decorador. Lo añado sin más y le paso el dto!

~~~js
@Serialize(UserDto)
@Get(':id')
async findUser(@Param('id') id: string) {
    await this.usersService.findOne(+id);
}
~~~
------

## Controller-Wide Serialization

- Puedo aplicar el decorador **@Serialize** que acabo de crear **a nivel de controlador**
- Al fin y al cabo todos los otros endpoints devuelven un user de uno u otro modo 
- users.controller.ts

~~~js
@Controller('auth')
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {} 
  
  (...)
  }
~~~

- Ahora los users que devuelven todos los handlers son sin el password
- Pero puedo necesitar otro tipo de respuesta (otro dto) por lo que colocaría **@Serialize(dto)** en el handler especifico
- Lo dejo en el controller
- Vamos con el tipado del dto
--------

## A Bit of Type Safety Around Serialize

- Realizar tipado en decoradores es bastante **desafiante**
- Typescript **no da soporte** a tipado en decoradores, por lo general
- Recuerda que en el callback de la función map del interceptor data es de tipo any
- Podemos hacer que al menos, lo que sea que le pase a **@Serialize** sea **una clase**
- Creo una interface fuera del interceptor

~~~js
interface ClassConstructor{
    new(...args: any[]): {}
}
~~~

- Esta interfaz viene a decir **cualquier clase que me pases está bien**
- Le paso el tipo al dto, tanto en el constructor del interceptor como en el decorador **@Serialize** 

