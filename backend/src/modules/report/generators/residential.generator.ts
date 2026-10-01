import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { ResidentialReportViewModel } from '../report.types';
import { buildResidentialViewModel } from './residential/residential-viewmodel.builder';

// Đăng ký các Handlebars Helper dùng chung
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
Handlebars.registerHelper('gt', (a: any, b: any) => Number(a) > Number(b));
Handlebars.registerHelper('gte', (a: any, b: any) => Number(a) >= Number(b));
Handlebars.registerHelper('inc', (v: any) => Number(v) + 1);
Handlebars.registerHelper('addOne', (v: any) => Number(v) + 1);
Handlebars.registerHelper('or', function(...args: any[]) {
  args.pop(); // remove Handlebars options
  return args.some(Boolean);
});
Handlebars.registerHelper('and', function(...args: any[]) {
  args.pop(); // remove Handlebars options
  return args.every(Boolean);
});
Handlebars.registerHelper('isNotEmpty', (arr: any) => Array.isArray(arr) && arr.length > 0);

export class ResidentialReportGenerator {
  /**
   * Chuyển đổi dữ liệu DB sang ViewModel đầy đủ bám sát báo cáo Phase 1 CRLG
   */
  static buildViewModel(reportData: any): ResidentialReportViewModel {
    return buildResidentialViewModel(reportData);
  }

  /**
   * Tạo chuỗi HTML hoàn chỉnh từ ViewModel và Template Handlebars
   */
  static generateHtml(viewModel: ResidentialReportViewModel): string {
    const candidateDirs = [
      path.resolve(__dirname, '../templates/residential'),
      path.resolve(__dirname, '../../../../src/modules/report/templates/residential'),
      path.resolve(__dirname, '../../../src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'backend/src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'dist/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'backend/dist/modules/report/templates/residential'),
    ];
    const templateDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'index.hbs'))) || candidateDirs[0];
    const templatePath = path.join(templateDir, 'index.hbs');
    const stylesPath = path.join(templateDir, 'styles.css');

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const styles = fs.readFileSync(stylesPath, 'utf8');

    const compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate({
      ...viewModel,
      styles,
    });
  }
}
