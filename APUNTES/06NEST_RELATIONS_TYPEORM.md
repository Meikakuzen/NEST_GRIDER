# 06 NEST RELATIONS IN TYPEORM

- Vamos con reports!
- Un endpoint POST le va a permitir al usuario recibir info del vehículo que ha vendido
- Otro endpoint GET les va a permitir a otros usuarios obtener una valoración del coche
- Un tercer endpoint PATCH que aprueba o rechaza un report hecho por un user
----

## Adding Properties to Reports

- Lo que hay que hacer con el módulo reports se asemeja mucho a lo hecho con users
- Vamos con el la entity, a añadir ciertas propiedades que necesito en el report

~~~js
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Report {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    price: number

    @Column()
    make: string //marca

    @Column()
    model: string

    @Column()
    year: number

    @Column()
    lng: number

    @Column()
    lat: number

    @Column()
    mileage: number
}
~~~

- Ahora que tengo la entidad vayamos con el controlador y el servicio!
-----

## A Dto for  report creation

- Vamos a centrarnos en tener la habilidad de crear un nuevo reporte

~~~js
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Body() body: CreateReportDto) {
    return this.reportsService.create(body);
  }
}
~~~

- En create-report.dto.ts

~~~js
export class CreateReportDto {
    make: string

    model: string

    year: number

    lng: number

    lat: number

    mileage: number

    price: number
}
~~~

- Añado la **validación** con los validators de **class-validator**
- Para el año del coche voy a querer validar que sea un año válido, por lo que usaré Min y Max
- Para la longitud y latitud del punto de venta tengo isLatitude e isLongitude
- Pongo de máximos un millón de kilometraje y un millón de precio

~~~js
import {IsString, IsNumber, Min, Max, isLatitude, IsLongitude, IsLatitude} from 'class-validator'


export class CreateReportDto {
    
    @IsString()
    make: string

    @IsString()
    model: string

    @IsNumber()
    @Min(1900)
    @Max(2050)
    year: number

    @IsLongitude()
    lng: number

    @IsLatitude()
    lat: number

    @IsNumber()
    @Min(0)
    @Max(1000000)
    mileage: number

    @IsNumber()
    @Min(0)
    @Max(1000000)
    price: number
}
~~~

- Para asegurarme de que el usuario esté autenticado usaré el AuthGuard que construí por eso lo dejé en /src/guards

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

- Importo **UseGuards** de @nestjs/common y el **AuthGuard** 
- Lo coloco en el POST. Esto me asegura que la persona esté logeada

~~~js
@Post()
@UseGuards(AuthGuard)
create(@Body() body: CreateReportDto) {
return this.reportsService.create(body);
}
~~~

- Vamos con el servicio!
------

## Saving a report with the Reports Service

- Primero debo inyectar el repo (la entidad)
- En el ReportsService

~~~ts
constructor(@InjectRepository(Report) private  report: Repository<Report>){}
~~~

- En el método create de ReportsService

~~~js
create(reportDto: CreateReportDto) {
const report = this.repo.create(reportDto)

return this.repo.save(report)
}
~~~

- Compruebo que todo funciona adecauadamente con ThunderClient o Postman o los archivos .http
- Puedo hacerlo también creando un archivio http dentro de reports
- Sirve para documentar. No tiene porqué estar en reports, puede estar a nivel de aplicación
- Debo tener instalado REST Client
- Recuerda que debo estar logueado para poder postear!!
- requests.http

~~~http
POST http://localhost:3000/reports
content-type: application/json

{
    "price": 1000,
    "make": "Honda",
    "model": "Civic",
    "year": 1993,
    "lng": 0,
    "lat": 0,
    "mileage": 1000
    
    }
~~~
-----

## Building Associations

- Vamos a **asociar el user con con el report** que crea
- En la tabla reports necesitamos una columna de user_id
- Hay varios tipos de asociación, entre ellas una es **OneToMany** (de uno a muchos) y **ManyToOne** (de muchos a uno)
- Muchos productos pueden ser de un usuario
- Un usuario puede tener muchos productos
- Tambien hay OneToOne (ej:pasaporte-persona), ManyToMany (ej:clases-estudiantes)
- Puedo usar los **decoradores OneToMany y ManyToOne** de typeorm
- En user.entity uso **OneToMany**, el callback devuelve la entidad y otro callback donde le paso la entidad y puedo devolver el user
- Entonces primero le paso la entidad y luego el campo con el que quiero la relación
  - Marca error porque todavía no lo he definido el user con **ManyToOne** en report.entity
- user.entity.ts

~~~js
@OneToMany(()=> Report, (report)=> report.user)
reports: Report[]
~~~

- En report hago lo mismo pero con **MayToOne** y la entidad User

~~~js
@ManyToOne(()=> User, (user)=> user.reports)
user: User
~~~

## NOTA: al modificar con ManyToOne debo borrar la development.sqlite
-------

## More on Decorators

- **INFO ADICIONAL**
- La asociación de los reports cuando buscamos un usuario no está automáticamente definida, no me lo devolverá en la respuesta
- Lo mismo pasa cuando buscamos un report. No me va a devolver el user al que pertenece en la respuesta 
- Puedo colocar un console.log(User) en la entidad Report y otro con Report en la entidad User
- User devuelve undefined y el otro devuelve class Report
- Por el hecho de tener una relación circular, esto indica que la entity Report se ejecuta primero
- Significa que en el punto de la entity Report, User todavía no se ha ejecutado
  - Entonces no puedo hacer referencias directamente a User dentro Report
  - Por eso la función que devuelve la entidad, **para solventar este problema**
- En el segundo callback, coje la entidad y hace referencia al campo especificado
------

## Associations with Nest and TypeORM

- En POST /reports recibo la cookie y el body que debe validar CreateReportDto
- Para extraer el usuario vamos a usar el decorador **@CurrentUser**, con lo que recibiremos una instancia de User
- Con todo ello se crea una nueva instancia de Report y se salva con el metodo save del repo Reports
- En reports.controller

~~~js
@Post()
@UseGuards(AuthGuard)
create(@Body() body: CreateReportDto, @CurrentUser() user: User) {
  return this.reportsService.create(body, user);
}
~~~

- En el reports.service le asigno el user a la instancia que he creado con el body

~~~js
create(reportDto: CreateReportDto, user: User) {
  const report = this.repo.create(reportDto)
  report.user = user
  return this.repo.save(report)
}
~~~
------

- Ahora cuando creo un report me devuelve el usuario que lo ha creado, pero también me devuelve el password en la respuesta
- Vamos a arreglarlo!
------

## Formatting de Report Response

- Vamos a aplicar el **Serializer**(interceptor)
- Quiero evitar enviar el password en la respuesta
- Para esto usaré el serialize.interceptor creado anteriormente
- Necesito crear un Dto que represente cómo quiero que luzca la respuesta
- Lo que quiero es que solo aparezca una propiedad llamada userId con el id del usuario, no un objeto con toda la info del user 
- Entonces, voy a **añadir la propiedad userId** con el id del user en la respuesta **en lugar del objeto user** entero
------

## Transformig properties with a Dto

- Creo en /reports/dto/reports.dto.ts
- Importo Export y Transform de class-transformer
- También la entity User

~~~js
import { Expose, Transform} from 'class-transformer'
import { User } from 'src/users/entities/user.entity'


export class ReportDto{
    @Expose()
    id: number

    @Expose()
    price: number

    @Expose()
    year: number

    @Expose()
    lng: number

    @Expose()
    lat: number

    @Expose()
    make: string

    @Expose()
    model: string

    @Expose()
    mileage: number
}
~~~

- Lo importo en el controlador y lo uso con **Serialize** (el interceptor que creé)
- Le digo que quiero serializar la respuesta acorde al ReportDto

~~~js
@Post()
@UseGuards(AuthGuard)
@Serialize(ReportDto)
create(@Body() body: CreateReportDto, @CurrentUser() user: User) {
  return this.reportsService.create(body, user);
}
~~~

- Para cambiar la respuesta y añadir una nueva propiedad uso **@Transform**
- Desestructuro **obj**, que **es una referencia a la entidad Report original**
- Uso obj para acceder a user.id
- reports.dto

~~~js
@Transform(( {obj} )=> obj.user.id)
  @Expose()
  userId: number
~~~
-----

