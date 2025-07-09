import express from 'express';
import { generateReport,downloadReportPDF } from '../controllers/report.controller';

const router = express.Router();

router.get('/view', generateReport);
router.get('/download', downloadReportPDF);
export default router;
