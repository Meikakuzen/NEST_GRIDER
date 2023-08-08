# 04 NEST UNIT TESTING GRIDER

- Unit testing -> asegurarse de que métodos en una clase funcionan adecuadamente
- Integration Testing -> testear el flow entero de la aplicación
- En el directorio test tengo app.e2e-spec.ts que es un test end-to-end. Comprueba que el servidor devuelva un 200
- Vamos a empezar el testing con el auth.service
- Debemos asegurarnos que signin y signup retornen un output adecuado
  - Para ello necesitamos una copia de UsersService, que depende de UsersRepository que consulta la DB de SQLite
  - Usaremos la inyección de dependencias 
  - Vamos a hacer una copia fake de UsersService
    - Será una clase temporal que definiremos en el archivo de testing con los métodos que necesitemos
    - Crearemos una instancia de AuthService para que use este servicio fake
    - Para esto crearemos un Container con inyección de dependencias, con el AuthService y el UsersService fake (una clase con los métodos de UsersService)
------

## Testing Setup

- Importo:
  - Test de @nestjs/testing
  - AuthService
  - UsersService
- Debo crear el módulo DI Container (DI=Dependency Injection)
- Luego debo crear una copia del AuthService
- Debo resolver las dependencias del AuthService (UsersService), pero puedo comprovar si se ha definido adecuadamente
- Luego refactorizaré este código
- users/auth.service.spec.ts

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";

it('can create an instance of auth service', async()=>{
    const module = await Test.createTestingModule({
        providers: [AuthService]
    }).compile()

    const service = module.get(AuthService)

    expect(service).toBeDefined()
})
~~~

- Para correr el test uso npm run test:watch
- El test falla porque el módulo contiene UsersService (dependencia de AuthService)
- Vamos a crear una copia fake de UsersService con los métodos find y create
- Lo añado al array de providers dentro de un objeto con las propiedades provide y useValue

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";

it('can create an instance of auth service', async()=>{

    const fakeUsersService = {
        find: ()=> Promise.resolve([]),
        create: (email: string, password: string)=> Promise.resolve({id: 1, email, password }) 
    }


    const module = await Test.createTestingModule({
        providers: [AuthService,
        {
            provide: UsersService,
            useValue: fakeUsersService
        }]
    }).compile()

    const service = module.get(AuthService) //crea una instancia de AuthService

    expect(service).toBeDefined()
})
~~~

- Ahora pasa el test porque hemos resuleto la dependencia

## NOTA: Para acelerar los tests cambiar el script a "jest --watch --maxWorkers=1"
--------

## Testing is a little bit confusing

- Veamos que pasa en el array de providers
- Este array es una lista de clases que queremos inyectar en el DI Container
- Con el objeto le estamos diciendo que cualquiera que pregunte por UsersService dale el objeto fakeUsersService que es {find,create}
-----

## Getting Typescript to Help with Mocks

- El UsersService también tiene el método update, remove...aunque find y create son los únicos usados por AuthService on signin y signup 
- Usamos Promise.resolve, porque en la vida real esto sería una consulta a la DB. Crea una promesa y la resuelve inmediatamente con el valor dado
- Ahora mismo si hago const arr = await fakeUsersService.fin() me devuelve un array vacío
- Estamos pasando fakeUsersService como UsersService, pero el primero no contiene todos los métodos del segundo
- Typescript no nos está ayudando a implementar todos los métodos como haría una interfaz
- Tampoco me está ayudando con el valor de retorno de create y find de fakeUsersService
- Solucionemoslo!
- Uso el tipado con Partial para no tener que implementar todos los métodos
- Se supone que create debe devolver una instancia de User, debería implementar logInsert, logUpdate y logRemove
- Como no quiero implementar estos métodos en el objeto uso as User

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";

it('can create an instance of auth service', async()=>{

    const fakeUsersService: Partial<UsersService> = {
        find: ()=> Promise.resolve([]),
        create: (email: string, password: string)=> Promise.resolve({id: 1, email, password } as User) 
    }

    const module = await Test.createTestingModule({
        providers: [AuthService,
        {
            provide: UsersService,
            useValue: fakeUsersService
        }]
    }).compile()

    const service = module.get(AuthService)

    expect(service).toBeDefined()
})
~~~
-------

## Improving File Layout

- Como voy a usar ek servicio en todos los tests, para no repetir código usor beforeEach
- Para poder usar service (al estar un scope diferente) defino la variable fuera del scope
- Lo envuelvo todo en un bloque  describe

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";


describe('auth service testing', ()=>{

    let service: AuthService;
    
    beforeEach(async ()=>{
        
        const fakeUsersService: Partial<UsersService> = {
            find: ()=> Promise.resolve([]),
            create: (email: string, password: string)=> Promise.resolve({id: 1, email, password } as User) 
        }
    
        const module = await Test.createTestingModule({
            providers: [AuthService,
            {
                provide: UsersService,
                useValue: fakeUsersService
            }]
        }).compile()
    
        service = module.get(AuthService)
    })
    
    it('can create an instance of auth service', async()=>{
    
        expect(service).toBeDefined()
    })
})
~~~
-------

## Ensuring Password Gets Hashed

- signup recibe un email y un password, comprueba si el usuario existe, genera el salt y el hash, crea un nuevo usuario con el email y el password encriptado
- Por último retorna el user
- Queremos que find devuelva un array vacío, porque en este caso, en el signup significa que no hay usuario con ese email
- Como espero que el password esté encriptado, no me debería devolver el mismo password
- Debería poder obtener el salt y el hash haciendo la división por el punto con split  

~~~js
it('creates a new user with a hashed and salted password', async ()=>{
       const user =  await service.signup('email@google.com', '123456')

       expect(user).not.toEqual('123456')

       const [salt, hash] = user.password.split('.')

       expect(salt).toBeDefined()
       expect(hash).toBeDefined()
    })
~~~

- El test pasa
-----

## Throws an Error if user signs up

- Hago la misma jugada, para usar fakeUsersService lo declaro en el escope del describe y lo tipo
- En el signup le paso el mismo email y password que he declarado en el find del fakeUsersService
- Uso rejects.toThrow para lanzar BadRequestException

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { BadRequestException } from "@nestjs/common";

describe('auth service testing', ()=>{

    let service: AuthService;
    let fakeUsersService: Partial<UsersService>
    beforeEach(async ()=>{
        
        fakeUsersService = {
            find: ()=> Promise.resolve([]),
            create: (email: string, password: string)=> Promise.resolve({id: 1, email, password } as User) 
        }
    
        const module = await Test.createTestingModule({
            providers: [AuthService,
            {
                provide: UsersService,
                useValue: fakeUsersService
            }]
        }).compile()
    
        service = module.get(AuthService)
    })
    
    it('can create an instance of auth service', async()=>{
    
        expect(service).toBeDefined()
    })

    it('creates a new user with a hashed and salted password', async ()=>{
       const user =  await service.signup('email@google.com', '123456')

       expect(user).not.toEqual('123456')

       const [salt, hash] = user.password.split('.')

       expect(salt).toBeDefined()
       expect(hash).toBeDefined()
    })

    it('throws an error if user signs up with email that is in use', async()=>{
        fakeUsersService.find = ()=> Promise.resolve([{id:1, email: "email@google.com", password: '123456'} as User])
        await expect(service.signup("email@google.com",'123456')).rejects.toThrow(BadRequestException)
    })
})
~~~
-----

## Throws if signin is called with an unused email

- Como el fakeUsersService pasa por el beforeEach, se reinicia.
- Quiero decir que en el scope global, el find del fakeUsersService devuelve un arreglo vacío y eso es precisamente lo que nos interesa

~~~js
 it('throws if signin is called with an unused email', async()=>{

       await  expect(service.signin('correo@email.com', '123456'))
                            .rejects.toThrow(NotFoundException)

    })
~~~
----

## Invalid password

~~~js
it('invalid password returns error', async ()=>{
    fakeUsersService.find= ()=> Promise.resolve([{email: 'correo@gmail.com', password: '123456'} as User])

    expect(service.signin('correo@gmail.com', 'uhiuh122792')).rejects.toThrow(BadRequestException)
})
~~~
----

## More intelligent mocks

- Para hacer más realista el fakeUsersService, vamos a hacer que el método create guarde el email y password en un array
- Y el find busque en este array
- Así los passwords harán match y voy a poder testar si le doy un password correcto, que me devuelva un user
- Creo una variable que será el arreglo de users
- En el find filtro por el email y devuelvo el usuario filtrado del array de users en el resolve
- En create creo el usuario, lo subo al array con push y lo retorno en el resolve

~~~js
describe('auth service testing', ()=>{

    let service: AuthService;
    let fakeUsersService: Partial<UsersService>
    beforeEach(async ()=>{
        
        const users: User[] = []

        fakeUsersService = {
            find: (email:string)=> {
                const filteredUsers= users.filter(user=> user.email === email)
                return Promise.resolve(filteredUsers)
            },
            create: (email:string, password: string)=>{
                    const user = {id: Math.floor(Math.random() * 9999), email, password} as User
                    users.push(user)
                    return Promise.resolve(user)
            } 
        }
        //resto del código
     })
 })
~~~

- Ahora el test de dar un password correcto si da match
  
~~~js
it('returns a user if a valid password is provided', async()=>{
    await service.signup('correo@gmail.com', '123456')
    const user = await service.signin('correo@gmail.com', '123456')

    expect(user).toBeDefined()
})
~~~
-------

## Refactor to use intelligent mocks

- Debo sustituir el userFakeService por el service.signup como corresponda

~~~js
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { BadRequestException, NotFoundException } from "@nestjs/common";


describe('auth service testing', ()=>{

    let service: AuthService;
    let fakeUsersService: Partial<UsersService>
    beforeEach(async ()=>{
        const users: User[] = []

        fakeUsersService = {
            find: (email:string)=> {
                const filteredUsers= users.filter(user=> user.email === email)
                return Promise.resolve(filteredUsers)
            },
            create: (email:string, password: string)=>{
                    const user = {id: Math.floor(Math.random() * 9999), email, password} as User
                    users.push(user)
                    return Promise.resolve(user)
            } 
        }
    
        const module = await Test.createTestingModule({
            providers: [AuthService,
            {
                provide: UsersService,
                useValue: fakeUsersService
            }]
        }).compile()
    
        service = module.get(AuthService)
    })
    
    it('can create an instance of auth service', async()=>{
    
        expect(service).toBeDefined()
    })

    it('creates a new user with a hashed and salted password', async ()=>{
       const user =  await service.signup('email@google.com', '123456')

       expect(user).not.toEqual('123456')

       const [salt, hash] = user.password.split('.')

       expect(salt).toBeDefined()
       expect(hash).toBeDefined()
    })

    it('throws an error if user signs up with email that is in use', async()=>{
        await service.signup('email@google.com', '123456')
        await expect(service.signup("email@google.com",'123456')).rejects.toThrow(BadRequestException)
    })

    it('throws if signin is called with an unused email', async()=>{

       await  expect(service.signin('correo@email.com', '123456'))
                            .rejects.toThrow(NotFoundException)

    })

    it('returns a user if a valid password is provided', async()=>{
        await service.signup('correo@gmail.com', '123456')
        const user = await service.signin('correo@gmail.com', '123456')

        expect(user).toBeDefined()
    })

    it('invalid password returns error', async ()=>{
        
        await service.signup('correo@gmail.com', '123456')

        await expect(service.signin('correo@gmail.com', 'uhiuh122792')).rejects.toThrow(BadRequestException)
    })
})
~~~

## Unit Testing a Controller

- Vamos a testar UserController
- Testar **decoradores** es un pelin complicado. **No los vamos a testar**, vamos a hacer cómo que no están.
- Vamos a imaginar que no están, y que solo está el controlador con lo que sea que tenga **como argumento y valor de retorno**
- Voy a tener que mockear el AuthService y el UsersService
- Observo en el controlador cuales son los métodos que usa cada handler
- Los defino en el fakeUsersService y el fakeAuthService

~~~js
import { Test, TestingModule } from "@nestjs/testing"
import { UsersController } from "./users.controller"
import { UsersService } from "./users.service"
import { AuthService } from "./auth.service"
import { User } from "./entities/user.entity"

describe('UsersController test', ()=>{
    let controller: UsersController
    let fakeUsersService: Partial<UsersService>
    let fakeAuthService: Partial<AuthService>

    beforeEach(async()=>{
        fakeUsersService={
            findOne: ()=>{},
            find: ()=>{},
            remove: ()=> {},
            update: ()=>{}
        }

        fakeAuthService={
            signup: ()=>{},

            signin: ()=>{}
        }

        const module : TestingModule = await Test.createTestingModule({

            controllers: [UsersController],
            
        }).compile()

        controller = module.get<UsersController>(UsersController)
    })

})
~~~

- Si coloco el cursor encima de cada método Typescript me dice qué espera de él
- Dejando el update para después, que incorpora el UpdateUserDto, para satisfacer los tipados del resto quedaría algo así

~~~js
beforeEach(async()=>{
        fakeUsersService={
            findOne: (id: number)=> Promise.resolve({id, email:"correo@gmail.com", password:'123456'} as User),
            find: (email: string)=> Promise.resolve([{email, password:'123456'} as User]),
            remove: (id: number)=> Promise.resolve({id, email:"correo@gmail.com", password:'123456'} as User),
            //update: (id: number )=>{}
        }

        fakeAuthService={
            signup: (email: string, password: string)=> Promise.resolve({email, password} as User),

            signin: (email: string, password: string)=> Promise.resolve({email, password} as User)
        }

        const module : TestingModule = await Test.createTestingModule({

            controllers: [UsersController],
            
        }).compile()

        controller = module.get<UsersController>(UsersController)
    })
~~~

- Los handlers findUser y findAll del controller usa los métodos find y findOne del UsersService
- Vamos con ello!
- Si quiero usar fakeUsersService tengo que decírselo al DI Container

~~~js
const module : TestingModule = await Test.createTestingModule({

    controllers: [UsersController],
    providers:[
        {
            provide: UsersService,
            useValue: fakeUsersService
        },
        {
            provide: AuthService,
            useValue: fakeAuthService
        }
    ]
    
}).compile()
~~~

## NOTA: a veces da error la ruta de importación y es porque en lugar de poner src/ se debe poner ../

- Este test pasa

~~~js
import { Test, TestingModule } from "@nestjs/testing"
import { UsersController } from "./users.controller"
import { UsersService } from "./users.service"
import { AuthService } from "./auth.service"
import { User } from "./entities/user.entity"

describe('UsersController test', ()=>{
    let controller: UsersController
    let fakeUsersService: Partial<UsersService>
    let fakeAuthService: Partial<AuthService>

    beforeEach(async()=>{
        fakeUsersService={
            findOne: (id: number)=> Promise.resolve({id, email:"correo@gmail.com", password:'123456'} as User),
            find: (email: string)=> Promise.resolve([{email, password:'123456'} as User]),
            remove: (id: number)=> Promise.resolve({id, email:"correo@gmail.com", password:'123456'} as User),
            //update: (id: number )=>{}
        }

        fakeAuthService={
            signup: (email: string, password: string)=> Promise.resolve({email, password} as User),

            signin: (email: string, password: string)=> Promise.resolve({email, password} as User)
        }

        const module : TestingModule = await Test.createTestingModule({

            controllers: [UsersController],
            providers:[
                {
                    provide: UsersService,
                    useValue: fakeUsersService
                },
                {
                    provide: AuthService,
                    useValue: fakeAuthService
                }
            ]
            
        }).compile()

        controller = module.get<UsersController>(UsersController)
    })

    it('UsersController is defined', ()=>{
        expect(controller).toBeDefined()
    })

})
~~~
-----

## Not Super Effective Tests

- En el controller, findAllUsers solo usa el método find de UsersService
- Recuerda que no tenemos la habilidad de testar lo relacionado con los decoradores

~~~js
it('should return all users', async()=>{
    const users = await controller.findAll('email@gmail.com')
        expect(users.length).toEqual(1)
        expect(users[0].email).toEqual('email@gmail.com')
})
~~~

- Los controladores, obviando los decoradores, tienen una lógica muy simple
- findUser usa findOne del UsersService

~~~js
it('should return one user', async()=>{

    const user = await controller.findUser('1')

    expect(user).toBeDefined()   //NO ENTIENDO PORQUE NO PASA ESTE TEST, devuelve undefined
})
~~~

- Este tampoco funciona, devuelve undefined

~~~js
it('throws an error if user given id is not found', async()=>{
    fakeUsersService.findOne = ()=> null
    await expect(controller.findUser('1')).rejects.toThrow(NotFoundException) 
})
~~~

## NOTA: El error estaba en el controlador! Tenía solo el await sin el return!!!

~~~js
@Get(':id')
async findUser(@Param('id') id: string) {
return await this.usersService.findOne(+id);
}
~~~
------

## Testing signin

- Para el signin debemos darle un body de tipo createUserDto y un objeto session (de tipo any)
- Implementa el authService.signin con un email y un password sacados del body
- El id debe asignarse al objeto session
- Devuelve un user

~~~js
@Post('/signin')
async signIn(@Body() body: CreateUserDto, @Session() session: any){
const user = await this.authService.signin(body.email, body.password)
session.userId = user.id
return user
}
~~~

- No podemos asegurar de que devuelva un usuario
- Y de que la userId sea asignada a la session
- En el fakeAuthService en la hoja de testing me aseguro de harcodear un id

~~~js
fakeAuthService={
        signup: (email: string, password: string)=> Promise.resolve({email, password} as User),

        signin: (email: string, password: string)=> Promise.resolve({id: 1, email, password} as User)
    }
~~~

- Creo un objeto de session vacío en el test 
- En el signin le paso el objeto con email y password, lo que sería el body, y el objeto session que he creado vacío
- Para que no me de error de tipado con user.userId en el expect la inicio en el objeto de session

~~~js
it('signin updates session and returns user', async()=>{
    const session = {userId: 10}

    const user = await controller.signIn({email:'correo@gmail.com', password: '123456'}, session)

    expect(user.id).toEqual(1)
    expect(session.userId).toEqual(1)
})
~~~

- Es correcto porque en el metodo fake signin le puse id:1