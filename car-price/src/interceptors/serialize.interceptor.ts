import { UseInterceptors, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs";
import { plainToInstance } from "class-transformer";

export function Serialize(dto: ClassConstructor){
    return UseInterceptors(new SerializeInterceptor(dto))
}

interface ClassConstructor{
    new(...args: any[]): {}
}

export class SerializeInterceptor implements NestInterceptor {

    constructor(private dto:ClassConstructor){}

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