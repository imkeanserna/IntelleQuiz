import { Socket } from "socket.io";
import { Problem, Quiz } from "../Quiz";
import { v4 as uuidv4 } from 'uuid';
import { IoManager } from "./IoManager";
import { generateRandomString } from "../lib/randomStrings";
import prisma from "../db";

export enum Status {
   Waiting = "waiting",
   Started = "started",
   Ongoing = "ongoing",
   Finished = "finished",
}

export interface Room {
   id: string;
   name: string;
   admin: string;
   status: Status;
   quiz: Quiz;
   users: User[];
}

export interface User {
   id: string;
   username: string;
   points: number;
   image: string;
}

// timer 10 seconds to answer the problems
export const MAX_TIME_SEC = 10;
const MAXPOINTS = 200;

export class QuizManager {
   // public admin?: string;
   private rooms: Room[];

   constructor() {
      this.rooms = [];
   }

   findRoom(roomId: string) {
      const room = this.rooms.find((room: any) => room.id === roomId);
      if (!room) {
         return {
            room: null,
            error: "Room doesn't exist"
         };
      }
      return {
         room,
         error: null
      };
   }

   async addRoom(roomName: string, adminId: string, socket: Socket) {
      const room = await prisma.room.findFirst({
         where: {
            name: roomName,
            adminId: adminId
         }
      });
      // const room = this.rooms.find((room: Room) => room.name === roomName && room.admin === admin);
      if (room) {
         console.log("room is already exist " + roomName);
         // return {
         //    error: true,
         //    message: `${roomName} Room is already exist`,
         //    roomId: ""
         // };
         socket.emit("error", {
            error: `${roomName} Room is already exist`
         })
         return;
      }

      try {
         const roomId: string = generateRandomString(15)
         const newRoom = await prisma.room.create({
            data: {
               id: roomId,
               name: roomName,
               adminId,
            }
         });
         const quiz = await prisma.quiz.create({
            data: {
               roomId: roomId
            }
         })
         socket.emit("room", {
            message: "Room is successfully added",
            roomId: newRoom.id,
            quizId: quiz.id
         })
      } catch (e: any) {
         socket.emit("error", {
            error: `${roomName} Room is already exist`
         })
      }

      // this.rooms.push({
      //    id: roomId,
      //    name: roomName,
      //    admin,
      //    status: Status.Waiting,
      //    quiz: new Quiz(roomId),
      //    users: [],
      // })
      // console.log("successfully added room " + this.rooms)
      // return {
      //    error: false,
      //    message: "Room is successfully added",
      //    roomId
      // };
   }

   async addAdmin(username: string, socket: Socket) {
      try {
         const result = await prisma.admin.create({
            data: {
               username
            }
         })
         console.log(result)
         socket.emit("resultAdmin", {
            id: result.id,
            username: result.username
         })
      } catch (e: any) {
         socket.emit("error", {
            error: "Email / Username is already taken"
         })
      }
   }

   addUser(roomId: string, username: string, socket: Socket) {
      const room = this.rooms.find((room: Room) => room.id === roomId);
      console.log(room?.status)
      if (!room) {
         return { error: "Room doesn't exist" };
      }
      const user = room?.users.find((user: any) => user.username === username);
      if (user) {
         return { error: "User already in room" };
      }

      if (room.status === Status.Finished || room.status === Status.Ongoing || room.status === Status.Started) {
         return { error: `Quiz is ${room?.status}` }
      }

      // temporarily added this for avatar
      const randomNumber = Math.floor(Math.random() * 7) + 1;
      const id: string = uuidv4()
      room.users.push({
         id,
         username: username || "",
         points: 0,
         image: randomNumber.toString(),
      })
      socket.join(roomId);
      IoManager.io.to(roomId).emit("participants", {
         participants: room.users
      });
      return {
         id,
         roomId: room.id,
         image: randomNumber,
         status: room.status,
         problems: room.quiz.getQuiz()
      };
   }

   // async addQuiz(roomId: string, quizId: string, title: string, options: string[], answer: number, countdown: number, socket: Socket) {
   //    const room = prisma.room.findFirst({
   //       where: {
   //          id: roomId
   //       }
   //    })
   //    // const room = this.rooms.find((room: Room) => room.id === roomId)
   //    if (!room) {
   //       console.log("No room found")
   //       // return {
   //       //    error: true,
   //       //    message: "No room found"
   //       // };
   //       socket.emit("error", {
   //          error: `${roomId} Room is already exist`
   //       })
   //       return;
   //    }
   //
   //    // const quiz = room.quizes;
   //    try {
   //       const newProblem = await prisma.problem.create({
   //          data: {
   //             title: title,
   //          }
   //       })
   //       const options = await prisma.option.create({
   //          data: {
   //             choice: optio
   //          }
   //       })
   //
   //    } catch (e: any) {
   //       socket.emit("error", {
   //          error: ""
   //       })
   //    }
   //    // quiz.addQuiz(roomId, title, options, answer, countdown);
   //    // return {
   //    //    error: false,
   //    //    message: "Problem added successfully"
   //    // }
   // }

   async addProblem(quizId: string, title: string, options: string[], answer: number, countdown: number, socket: Socket) {
      try {
         const problem = await prisma.problem.create({
            data: {
               title: title,
               answer: answer,
               countdown: countdown,
               quizId: quizId
            }
         });

         const optionPromises = options.map((option: string) => {
            return prisma.option.create({
               data: {
                  choice: option,
                  problemId: problem.id
               }
            })
         });

         await Promise.all(optionPromises);

         socket.emit("success", {
            message: "Successfully added the problem"
         })
      } catch (e: any) {
         socket.emit("error", {
            error: "Failed to add problem"
         })
      }
   }

   getQuiz(roomId: string) {
      const room = this.rooms.find((room: Room) => room.id === roomId)
      if (!room) {
         console.log("No room found")
         return;
      }
      return room.quiz;
   }

   submitAnswer(userId: string, roomId: string, problemId: string, answer: number, countdown: number) {
      const endTime = new Date().getTime();
      const room = this.rooms.find((room: Room) => room.id === roomId)
      if (!room) {
         console.log("No room found")
         return;
      }
      const problem = room.quiz.getQuiz().find((problem: Problem) => problem.id === problemId);
      if (problem?.answer === answer) {
         const user = room.users.find((user: User) => user.id === userId);
         if (!user) {
            console.log("User is not found");
            return;
         }
         user.points += this.calculatePoints(room.quiz.startTime, endTime, countdown);
      }
   }

   calculatePoints(startTime: number, endTime: number, countdown: number) {
      const durationInMinutes = endTime - startTime;
      const durationInSeconds = durationInMinutes / 1000;
      const points = durationInSeconds > countdown ? 0 :
         MAXPOINTS * (1 - (durationInSeconds / countdown));

      return Math.round(points * 1000) / 1000;
   }

   async start(roomId: string, quizId: string) {
      // const room = this.rooms.find((room: Room) => room.id === roomId)

      const quiz = await prisma.quiz.findFirst({
         where: {
            id: quizId,
            roomId: roomId
         },
         select: {
            problems: {
               select: {
                  title: true,
                  options: true,
                  answer: true,
                  countdown: true,
                  quizId: true
               }
            },
            currentProblem: true,
            roomId: true
         }
      });

      if (!quiz) {
         return;
      }

      // console.log(quiz)

      try {
         const problem = quiz.problems[0];

         console.log(problem)

         const resultQuiz = await prisma.quiz.update({
            where: {
               id: quizId,
               roomId: roomId
            },
            data: {
               currentProblem: quiz.currentProblem + 1
            }
         });
         console.log(problem);
         console.log(resultQuiz);
      } catch (e: any) {
         console.log(e)
      }
      // if (!room) {
      //    console.log("No room found")
      //    return {
      //       error: true,
      //       message: "No room found",
      //       countdown: 0
      //    };
      // }
      //
      // const problem = room.quiz.start();
      // if (!problem) {
      //    console.log("You don't have a problem yet.")
      //    return {
      //       error: true,
      //       message: "You don't have a problem yet.",
      //       countdown: 0
      //    }
      // }
      //
      // if (room.status !== "waiting") {
      //    return {
      //       error: true,
      //       message: "You can't re-start the quiz",
      //       countdown: 0
      //    };
      // }
      // console.log(problem)
      // room.status = Status.Started;
      // room.quiz.startTime = new Date().getTime();
      //
      // IoManager.io.to(roomId).emit("problem", {
      //    problem: {
      //       id: problem.id,
      //       roomId: problem.roomId,
      //       title: problem.title,
      //       options: problem.options,
      //       countdown: problem.countdown,
      //    },
      //    status: room.status
      // });
      // console.log("kean started")
      // IoManager.io.to(roomId).emit("adminProblem", {
      //    problem,
      //    index: 0,
      //    status: room.status
      // })
      // return {
      //    error: false,
      //    message: "The quiz is started by the admin",
      //    countdown: problem.countdown
      // }
   }

   next(roomId: string) {
      const room = this.rooms.find((room: Room) => room.id === roomId)
      if (!room) {
         console.log("No room found")
         return {
            error: true,
            message: "No room found",
            countdown: 0
         };
      }

      const { error, problem, index }: any = room.quiz.next();
      if (error) {
         return {
            error: true,
            message: "There's no problems left.",
            countdown: 0
         }
      }
      room.status = Status.Ongoing;
      room.quiz.startTime = new Date().getTime();
      IoManager.io.to(roomId).emit("problem", {
         problem: {
            id: problem.id,
            roomId: problem.roomId,
            title: problem.title,
            options: problem.options,
            countdown: problem.countdown,
         },
         status: room.status
      });
      IoManager.io.to(roomId).emit("adminProblem", {
         problem,
         index,
         status: room.status
      })
      return {
         error: false,
         message: "",
         countdown: problem.countdown
      };
   }

   endQuiz(roomId: string) {
      const room = this.rooms.find((room: Room) => room.id === roomId)
      if (!room) {
         console.log("No room found")
         return {
            error: true,
            message: "No room found"
         };
      }

      room.status = Status.Finished;
      IoManager.io.to(roomId).emit("end", {
         status: room.status,
         leaderboard: this.leaderboard(room),
      });
      return {
         error: false,
         message: "Room is end"
      }
   }

   getLeaderboard(roomId: string, countdown: number) {
      const room = this.rooms.find((room: Room) => room.id === roomId)
      if (!room) {
         console.log("No room found")
         return;
      }

      setTimeout(() => {
         // const leaderboard = room.users.sort((a, b) => a.points - b.points).reverse();
         IoManager.io.to(roomId).emit("leaderboard", {
            leaderboard: this.leaderboard(room),
            status: "leaderboard",
         });
      }, countdown * 1000)
   }

   private leaderboard(room: Room) {
      return room.users.sort((a, b) => a.points - b.points).reverse();
   }
}
