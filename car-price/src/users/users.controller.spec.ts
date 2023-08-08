import { Test, TestingModule } from "@nestjs/testing"
import { UsersController } from "./users.controller"
import { UsersService } from "./users.service"
import { AuthService } from "./auth.service"
import { User } from "./entities/user.entity"
import { NotFoundException } from "@nestjs/common/exceptions"

describe('UsersController test', ()=>{
    let controller: UsersController
    let fakeUsersService: Partial<UsersService>
    let fakeAuthService: Partial<AuthService>

    beforeEach(async()=>{
        fakeUsersService={
            findOne: (id: number)=> Promise.resolve({id, email:'correo@gmail.com', password:'123456'} as User),
            find: (email: string)=> Promise.resolve([{email, password:'123456'} as User]),
            remove: (id: number)=> Promise.resolve({id, email:"correo@gmail.com", password:'123456'} as User)
            //update: (id: number )=>{}
        }

        fakeAuthService={
            signup: (email: string, password: string)=> Promise.resolve({email, password} as User),

            signin: (email: string, password: string)=> Promise.resolve({id: 1, email, password} as User)
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

    it('should return all users', async()=>{
        const users = await controller.findAll('email@gmail.com')
         expect(users.length).toEqual(1)
         expect(users[0].email).toEqual('email@gmail.com')
    })

    it('should return one user', async()=>{

        const user = await controller.findUser('1')

       expect(user).toBeDefined()   //NO ENTIENDO PORQUE NO PASA ESTE TEST, devuelve undefined
    })

    it('throws an error if user given id is not found', async()=>{
        fakeUsersService.findOne = ()=> null
       // await expect(controller.findUser('1')).rejects.toThrow(NotFoundException) 
    })

    it('signin updates session and returns user', async()=>{
        const session = {userId: 10}

        const user = await controller.signIn({email:'correo@gmail.com', password: '123456'}, session)

        expect(user.id).toEqual(1)
        expect(session.userId).toEqual(1)
    })

})
