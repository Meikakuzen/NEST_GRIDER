# 05 NEST MANAGE APP

- Vamos a instalar un paquete que nos configure el ConfigService

>  npm i @nestjs/config

- Este paquete incluye dotenv
- Podremos usar ConfigService para leer valores guardados en .env
- Vamos a ver como tener diferentes variables para el entorno de producción y el local
- No vamos a seguir las normas que dicta dotenv para la implementación
------

## Applying Dotenv for Config

- Creo .env.development y .env.test
- En .env.test escribo:

> DB_NAME= test.sqlite

- En .env.development escribo
  
> DB_NAME= development.sqlite

- En app.module importo **ConfigModule, ConfigService** 
- Configuro el ConfigModule con forRoot
- Con **isGlobal en true** significa que no necesito importar el ConfigModule en otros módulos. Sirve globalmente
- Debo especificar **el path** de los archivos .env que quiero usar
  - Uso un template string para indicarle que quiero usar el que esté utilizando **NODE_ENV**
- Según el entorno que se esté ejecutando buscará .env.development o .env.test
- Para usar el **ConfigService** y usar la variable de entorno para definir la database en el TypeOrmModule **necesito inyectarlo**
- Voy a tener que **refactorizar TypeOrmModule con forRootAsync**
    - Con **inject** inyecto el servicio
    - Con la función **useFactory** puedo retornar el objeto de configuración **usando el servicio**
    - Uso config.get para obtener la variable de entorno de tipo String

~~~js
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import {TypeOrmModule} from "@nestjs/typeorm"
import { User } from './users/entities/user.entity';
import { Report } from './reports/entities/report.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
export class AppModule {}
~~~

- Debo declarar el NODE_ENV para que no reciba .env.undefined
- En el package.json, en start:dev lo seteo
- Hago una instalación necesaria

> npm install cross-env

- Configuro el script:

> "start:dev": "cross-env NODE_ENV=development nest start --watch"

- Puedo hacer lo mismo con start, debug, test, test-watch, test-debug, menos en start:prod 
- Excluyo .env.development y .env.test con el .gitignore
- Entonces, con el ConfigService, he configurado una db para development y otra para testing

## NOTA: cuando ejecuto npm run test salta un error diciendo SQLITE_BUSY: database is locked
------

## Solving SQLite error

- Este error sucede porque Nest usa JEST. Jest va a leer app.e22-spec.ts (test de integración no visto en el curso, que tiene un beforeEach que crea una instancia de la aplicación que quiere acceder a test.sqlite) y los tests unitarios que tambien generan otra instancia de la app que quiere acceder a test.sqlite y SQLite no permite multiples conexiones diferentes, quiere ver solo una conexión .
- Como Jest va a tratar de leer todos los tests al mismo tiempo es un problema
- Vamos a decirle a Jest que solo ejecute un test cada vez, así irá más rápido tambien
- En package.json (para los tests de integración)

> "test:e2e": "cross-env NODE_ENV=development jest --config ./test/jest-e2e.json --maxWorkers=1"

- Borro el archivo de test.sqlite y pongo en marcha de nuevo el servidor con :test y no hay problema
----

## It works!

- Debemos borrar el archivo test.sql antes de cada sesión de test para que no de error
- Se crea solo al poner en marcha el servidor
- Se puede crear un beforeEach global en el test, para no tener que borrar la db en cada archivo de test dentro del beforeEach
- En jest-e2e-spec.ts añado

> "setupFilesAfterEnv: ["<rootDir>/setup.ts"]

- Este setup.ts se ejecutará antes de que los tests se ejecuten
- rootDir hace referencia al directorio donde se encuentra el archivo, /test
- Defino el setup.ts
  - Para borrar el archivo test.sqlite cada vez antes de ejecutar los tests uso librerías de Node
    - Uso el __dirname para ubicarme en el directorio, con .. subo un nivel y le digo el archivo a borrar
    - Si el test.sqlite no existe lanzará un error, por ello uso un try y un catch. El error me da igual

~~~js
import { rm } from "fs/promises";
import { join } from "path";


global.beforeEach(async()=>{

    try {
    await rm(join(__dirname, '..', 'test.sqlite'))
    } catch (error) {}

})
~~~

## NOTA: TypeOrm crea el archivo si no existe automáticamente
