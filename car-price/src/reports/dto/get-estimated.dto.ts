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