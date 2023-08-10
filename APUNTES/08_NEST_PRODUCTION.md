# 08 NEST PRODUCTION

- Para producción vamos a setear variables de entorno ya cambiar a Postgres
- Empezaremos por guardar el string que codifica la cookie en una variable de entorno
- Añado COOKIE_KEY a los archivos .env
- ConfigModule me da acceso a ConfigService
- Para usar ConfigService dentro de AppModule voy a usar inyección de dependencias
- Coloco la variable de entorno en app.module

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
  constructor(private configService: ConfigService){}

  configure(consumer: MiddlewareConsumer){
    consumer
      .apply(
        cookieSession({
          keys:[this.configService.get('COOKIE_KEY')]
        }),
      )
      .forRoutes('*')
  }
}

~~~
------

## Understanding the Synchronize flag

- Vamos a usar sqlite en development y testing, y Postgres en producción
- Una de las propiedades dentro del TypeOrmModule es la de syncronize: true **IMPORTANTE!!**
- Lo que hace synchronize es que si elimino alguna propiedad de la entity User, por ejemplo, la borrará también de la DB automáticamente
- Lo mismo si añado una propiedad a la entity
- Pero **no todo son cosas buenas del synchronize**
- Si **por error borro alguna propiedad, pierdo la data** de manera irrecuperable (a no ser que tenga un backup)
- Por eso, en development es recomendable tenerla en true, pero **no en producción**
- Cambiar a synchronize: false y no volverlo a usar en true
------

## The Theory behind Migrations

- **Migration** es un archivo con dos funciones dentro
  - up --> describe cómo actualizar la estructura de la DB
    - Añade la tabla users
    - Da a la tabla la columna mail
    - Da a la tabla la columna password
  - down --> describe cómo deshacer los pasos de up
    - Elimina la tabla users
- Podemos crear varios archivos Migration, otro para reports, por ejemplo, que cree la tabla reports con make, model,etc
- Es un pelín desafiente aplicar esta lógica
----

## Headaches with Config Management

- Nest y TypeORM funcionan realmente bien, pero con las migraciones no es lo mejor del mundo
- Con el servidor parado
  - Uso el CLI de TypeORM para generar un archivo migration vacío
  - Añado código al migration file
  - Uso el CLI de TypeORM para aplicar la migración a la DB
    - TypeORM CLI ejecutará solo los entity files + migration file, entonces conectará con la DB y hará los cambios, pero no tiene ni idea de lo que es NEST, ni ConfigModule, ni ConfigService, ni siquiera lo que hay dentro de AppModule
    - Pero AppModule es lo que define como me conecto a la DB!
    - Entonces, el CLI no tiene ni idea de cómo obtener el objeto {type: 'sqlite', database: 'db.sqlite', entities: [User, report]} necesario para la conexión
    - **Debemos configurar la conexión en un lugar para que lo pueda usar tanto NEST como el CLI de TypeORM**
    - Este es el punto
--------

## TypeORM and Nest Config is Great

- Tenemos que decirle al CLI cómo conectarse a la DB
- Configurar NEST y TYpeORM puede ser un poco **NIGHTMARE**, estás avisado
- Acudir a la documentación:
  - Como crear una conexión
  - Crear un ormconfig.json para pasarle la info. TypeORM cargará automáticamente este archivo
    - Puede ser ormconfig.js o .ts .yml o .xml también
  - En el json no tenemos habilidades de scripting, tampoco en .yml o .xml por lo que solo me queda .ts y .js
  - TypeORM espera variables con nombres específicos (mirar docu) 
  - El sitio dónde sea que vayamos a publicar la app, va a darnos unas variables de conexión automáticamente que no tienen porqué coincidir en el nombre
  - Así que usar variables o variables de entorno para decirle al CLI lo que debe hacer no es una opción 
- Esto nos deja solo ormconfig.js y ormconfig.ts
- **AQUI ES DONDE LAS COSAS SE PONEN FEAS**
- En app.module comento el TypeOrmModule.forRootAsync y lo reemplazo por un forRoot sin ninguna configuración

~~~js
TypeOrmModule.forRoot()
~~~

- Esto me devuelve un error en consola porque no tiene ningún parametro de configuración
- En la raíz del proyecto creo ormconfig.ts

## NOTA: el uso de ormconfig está deprecado

~~~js
export ={
    type: 'sqlite',
    database: 'db.sqlite',
    entities: ['**/*.entity.ts'], //le paso el path de las entities
    synchronize: false
}
~~~

- Con esta configuración no es suficiente. Salta un error que dice unexpected token 'export'
- El orden de ejecución de NEST es primero todo lo que hay en src, lo pasa a JavaScript y lo coloca en dist
- Entonces Node corre el main.js
- TypeORM intenta correr ormconfig.ts como JavaScript pero se encuentra typescript, por eso falla
- Entonces, **no puedo usar .ts**
- **Solo me queda una opción: ormconfig.js**
- Cambio a .js. Al ser js debo usar js plano para el export

~~~js
module.exports ={
    type: 'sqlite',
    database: 'db.sqlite',
    entities: ['**/*.entity.ts'],
    synchronize: false
}
~~~

- Pero la cosa no acaba aquí. Ahora me sale el error de "Can not use imports statement outside a module" y apunta a report.entity
- En entities tengo archivos typescript y estos no se ejecutan hasta que son transformados a JavaScript
- Pasa lo mismo que antes, TypeORM intenta cargarlos antes de ser JavaScript
- Entonces, debo decirle que vaya a **/dist** para tener la versión de las entities en JavaScript
- **Debo cambiar el .ts de las entities por .js**

~~~js
module.exports ={
    type: 'sqlite',
    database: 'db.sqlite',
    entities: ['**/*.entity.js'],
    synchronize: false
}
~~~

- Para que funcione en development y test
- Ahora si uso npm run test:e2e me salta error porque usa ts-jest que lee archivos typescript y está recibiendo las entities en js
- Vamos a decirle a ts-jest que no importa si encuentra un archivo js, lo ejecute igual
- **En ts.config le añado "allowJs": true**
- No es suficiente. No encuentra User
- El test runner no es capaz de leer los .js que estan en dist como le indico en ormconfig

~~~js
module.exports= { 
    type: 'sqlite',
    database: 'development.sqlite',
    entities: process.env.NODE_ENV === "development"
    ? ['**/*.entity.js']
    : ['**/*.entity.ts'],
    synchronize: false
}
~~~
-----

## Env-Specific database Config

- Vamos a extraer algo de configuración del app.module y ponerlo dentro de ormconfig.js

~~~js
var dbConfig = {        
  synchronize: false  //puedo colocar aqui el synchronize y no en cada caso del switch
}

switch (process.env.NODE_ENV){
  case 'development':
    Object.assign(dbConfig,{
      type: 'sqlite',
      database: 'development.sqlite',
      entities: ['**/*.entity.js'],
      //synchronize: false
    });
    break;
  case 'test':
    Object.assign(dbConfig,{
      type: 'sqlite',
      database: 'test.sqlite',
      entities: ['**/*.entity.ts'],
      //synchronize: false
    });
    break;
  case 'production':
    break;
    default:
      throw new Error('Unknown environment')
}

module.exports = dbConfig
~~~
-----

## Installing the TypeORM CLI

- Para instalar y poner a punto el CLI es mejor acudir a la docu
- TypeORM y el CLI no saben como interpretar archivos typescript, hay que configurarlo
- Añado un nuevo script a package.json

> "typeorm": "node --require tsnode/register  ./node_modules/typeorm/cli.js

- Vamos a usar este comando para generar un migration file
- Hay que añadir un par de opciones al objeto dbConfig al ormconfig.js [deprecated]

~~~js
var dbConfig = {        
  synchronize: false,
  migrations: [`migrations/*.js`],
  cli:{
    migrationsDir: 'migrations'
  } 
}
~~~

- Se creará un archivo .ts pero CLI solo trabaja con .js, por lo que algo habrá que transpilar la migración antes de ejecutarla
- -o genera un archivo .js

> npm run typeorm migration:generate -- -n initial-schema -o 

- Ahora en la carpeta migrations hay un archivo .js
- El CLI consulta las entidades de la app y hace los queryRunners automáticamente
## NOTA: falta código, es para hacerse una idea. El archivo lo genera automáticamente
~~~js
const {MigrationInterface, QueryRunner} = require("typeorm")

module.exports = class initialSchema19736173623 {
  name = 'initialSchema19736173623'

  async up(queryRunner){
    await queryRunner.query(`CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar,)`)
    await queryRunner.query(`CREATE TABLE "report" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "approved",)`)
    await queryRunner.query(`CREATE TABLE "temporary_report" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, )`)
    await queryRunner.query(`INSERT INTO "temporary_report" ("id" "approved", "price", "make", "model", "year")`)
    await queryRunner.query(`DROP TABLE "report"`)
    await queryRunner.query(`ALTER TABLE "temporary_report" RENAME TO "report"`)
  }

  async down(queryRunner){
    await queryRunner.query(`ALTER TABLE "temporary_report" RENAME TO "report"`)
    (..etc...)
  }
}
~~~
## NOTA: el archivo generado automáticamente no funciona. Es reemplazado por este

~~~js
const { MigrationInterface, QueryRunner, Table } = require('typeorm');
 
module.exports = class initialSchema1625847615203 {
  name = 'initialSchema1625847615203';
 
  async up(queryRunner) {
    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'email',
            type: 'varchar',
          },
          {
            name: 'password',
            type: 'varchar',
          },
          {
            name: 'admin',
            type: 'boolean',
            default: 'true',
          },
        ],
      }),
    );
 
    await queryRunner.createTable(
      new Table({
        name: 'report',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'approved', type: 'boolean', default: 'false' },
          { name: 'price', type: 'float' },
          { name: 'make', type: 'varchar' },
          { name: 'model', type: 'varchar' },
          { name: 'year', type: 'integer' },
          { name: 'lng', type: 'float' },
          { name: 'lat', type: 'float' },
          { name: 'mileage', type: 'integer' },
          { name: 'userId', type: 'integer' },
        ],
      }),
    );
  }
 
  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE ""report""`);
    await queryRunner.query(`DROP TABLE ""user""`);
  }
};
~~~

- Para ejecutar

> typeorm migration:run

- Tiene que salir en consola executed successfully
- Si diera error de db asegurate de borrar la development.sqlite
------

## Running Migration with e2e

- Da error 'no such table user'
- Para asegurarme que la migración se ejecute también con los tests e2e necesito añadir código al ormconfig [deprecated]
- Cada test que ejecuto automáticamente borra la db
- Entonces cada test necesita re-migrar la db
- Debe estar habilitado en tsconfig allowJs en true
- En ormconfig añado migrationsRun al switch, en el case de test
~~~js
case 'test':
    Object.assign(dbConfig,{
      type: 'sqlite',
      database: 'test.sqlite',
      entities: ['**/*.entity.ts'],
      //synchronize: false
      migrationsRun: true
    });
~~~
------

## Production DB Config

- Para usar Heroku subo la app a gitHub
- Para conectar con la db se usará process.env.DATABASE_URL proveida por Heroku
- Necesitamos crear la DB de Postgres
- En el ormconfig, en el case de production del  switch

~~~js
case 'production':
    Object.assign(dbCOnfig,{
      type: 'postgres',
      url: process.env.DATABASE_URL,
      migrationsRun: true, //para asegurarnos de ejecutar las migraciones
      entities: ['**/*.entity.js'], //uso .js
      ssl: {     //propiedad especifica de Heroku
        rejectUnathorized: false
      }
    })
    break;
~~~

- Me aseguro de instalar el driver de postgres

> npm i pg

- Instalar Heroku CLI según la documentación
------

## Heroku Specific Project Config

- Compruebo que estoy en heroku

> heroku auth:whoami

- Hay algo que cambiar en el main.ts
- Heroku da su propio puerto

~~~js
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
const cookieSession = require('cookie-session');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

 // app.use(cookieSession({
 //   keys:['lalala']
 // }))
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true
    })
  )
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
~~~

- En el directorio raíz creo Procfile (sin extensión)
- El comando para iniciar en producción en NEST es start:prod
- Antes hay que hacer el build pero Heroku lo hace automáticamente
- Procfile

~~~
web:  npm run start:prod
~~~

- En el tsconfig.build.json debo excluir el ormconfig y migrations
- Para segurarme que typescript no intenta compilar estos archivos .js

~~~js
{
  "extends": "./tsconfig.json",
  "exclude"; ["ormconfig.js", "migrations","node_modules", "test","dist", "**...more_code"]
}
~~~
-----

## Deploying the app

> git add .
> git commit - m "production commit"
> heroku create

- Creo la db de postgres

> heroku addons:create heroku-postgresql:name_db

- Seteo la cookie_key

> heroku config:set COOKIE_KEY=uoehyrbeiury879605
> heroku config:set NODE_ENV=production
> git push heroku master