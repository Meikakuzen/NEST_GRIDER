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