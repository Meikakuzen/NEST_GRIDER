import { AfterInsert, AfterRemove, AfterUpdate, Entity, Column, PrimaryGeneratedColumn, OneToMany  } from "typeorm";
import { Report } from "src/reports/entities/report.entity";

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    email: string

    @Column()
    password: string

    @Column({default: true})
    admin: boolean

    @AfterInsert()
    logInsert(){
        console.log('Inserted user with id', this.id)
    }

    @AfterRemove()
    logRemove(){
        console.log('Deleted user with id', this.id)
    }
    
    @OneToMany(()=> Report, (report)=> report.user)
    reports: Report[]

    @AfterUpdate()
    logUpdate(){
        console.log('Updated user with id', this.id)
    }

}
