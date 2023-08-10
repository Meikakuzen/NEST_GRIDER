import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { ApprovedReportDto } from './dto/approved-report.dto';
import { GetEstimateDto } from './dto/get-estimated.dto';

@Injectable()
export class ReportsService {

  constructor(@InjectRepository(Report) 
              private  repo: Repository<Report>){}

  create(reportDto: CreateReportDto, user: User) {
    const report = this.repo.create(reportDto)
    report.user = user
    return this.repo.save(report)
  }


  createEstimate({make, model, lat, lng, year, mileage}) {
    return this.repo.createQueryBuilder()
                    .select('AVG(price)', 'price') 
                    .where('make = :make', {make} )  
                    .andWhere('model = :model', {model})
                    .andWhere('lat - :lat BETWEEN -5 AND 5', {lat})
                    .andWhere('lng - :lng BETWEEN -5 AND 5', {lng})
                    .andWhere('year - :year BETWEEN -3 AND 3', {year})
                    .andWhere('approved IS TRUE')
                    .orderBy('ABS(mileage - :mileage)', 'DESC' )
                    .setParameters({mileage})
                    .limit(3)
                    .getRawOne() 
  }

  async changeApproval(id: number, approved: boolean) {

    const report = await this.repo.findOneBy({id})

    if(!report) throw new NotFoundException('Report not found')

    report.approved = approved
    return this.repo.save(report)
  }

  remove(id: number) {
    return `This action removes a #${id} report`;
  }
}
