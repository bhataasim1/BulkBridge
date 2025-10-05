import cors from 'cors';
import express, { Request, Response } from 'express';
import Environment from './environment';
import { uploadRouter } from './router/upload.router';

class BulkBridgeServer {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.configureMiddleware();
    
    this.setupRoutes();
  }

  private configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cors());
  }

  private setupRoutes() {
    this.app.get('/', (req: Request, res: Response) => {
      res.send('Bulk Bridge Server is running');
    });

    this.app.use('/api', uploadRouter);
  }


  public start() {
    const PORT = Environment.getPort();
    this.app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }
}

const server = new BulkBridgeServer();
server.start();