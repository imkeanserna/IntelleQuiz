import { useContext, useEffect, useState } from "react";
import Input from "../../components/Input.tsx";
import Button from "../../components/Button.tsx";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useSetRecoilState } from "recoil";
import { UserInfo, userInfoAtom } from "../../store/user.ts";
import { useSocket } from "../../lib/hooks.ts";
import { Socket } from "socket.io-client";
import { userRegisterInput, signinInput } from "../../zod/authValidation.ts";
import Cookies from 'js-cookie'
import { ThemeContext } from "../../contexts/ThemeContext.tsx";
import { ThemeContextInterface } from "../../lib/types.ts";
import SourceCode from "../../components/SourceCode.tsx";
import gitHub from "../../assets/github-mark.svg";
import GoogleAuth from "../../components/GoogleAuth.tsx";
import Title from "../../components/Navbar/Title.tsx";
import LoadingCircle from "../../components/LoadingCircle.tsx";

export default function Signin() {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const navigate = useNavigate();
   const setUserInfo = useSetRecoilState<UserInfo>(userInfoAtom);
   const socket: Socket = useSocket("Bearer ");
   const [error, setError] = useState("");
   const [isLoading, setLoading] = useState(true);

   const onClickHandler = () => {
      setLoading(false);
      const validation: any = signinInput.safeParse({ email, password });
      if (!validation.success) {
         const errors: any = JSON.parse(validation.error.message);
         setError(errors[0].message);

         setTimeout(() => {
            setError("")
         }, 3000)
         setLoading(true);
         return;
      }

      socket.emit("SigninUser", {
         email,
         password
      });
   }

   useEffect(() => {
      if (Cookies.get('token')) {
         navigate('/room')
      }
      socket.on("error", async ({ error }: { error: string }) => {
         setLoading(true);
         toast(error, {
            className: "bg-gray-950 text-white",
            duration: 5000,
            icon: <ErrorIcons />
         })
      });

      socket.on("signed", async ({ message, data, token }: {
         message: string,
         data: UserInfo,
         token: string
      }) => {
         setUserInfo({
            id: data.id,
            username: data.username,
            email: data.email,
            image: data.image
         })
         // set the cookie
         Cookies.set('token', token, {
            expires: 5,
            secure: true,
            sameSite: 'Strict'
         });

         // set the user info in localStorage
         setUserInfo(data);

         setLoading(true);
         toast.success(message, {
            duration: 5000
         });
         navigate("/room");
      })

      return () => {
         socket.off("error")
         socket.off("signed")
      }
   }, [socket, setUserInfo, navigate])

   const { darkTheme, toggleTheme } = useContext(
      ThemeContext
   ) as ThemeContextInterface;

   return <div className="flex flex-col justify-center bg-bgColor text-bgColor h-screen items-center">
      <div className="mb-10">
         <Title />
      </div>
      <div className={` ${!darkTheme ? "text-gray-950" : "text-white"} w-[500px] border border-gray-700 shadow-md px-10 py-14 rounded-lg`}>
         <p className="text-[22px] text-center mb-4">Sign in to your account</p>
         <GoogleAuth />
         <p className="text-sm text-gray-500 text-center mt-5 mb-8">or contiue with email</p>
         <div className={`flex flex-col gap-6 `}>
            <div className={`${error !== "" ? "block vibrate" : "hidden"} border border-gray-400 rounded-lg text-center py-3 px-2 my-4 bg-red-700 text-sm text-white w-full shadow-lg`}>{error}</div>
            <div>
               <p className="mb-4">Email</p>
               <Input
                  type="text"
                  placeholder="your@email.com"
                  onChange={(e: any) => {
                     setEmail(e.target.value);
                  }}
               />
            </div>
            <div>
               <p className="mb-4 ">Password</p>
               <Input
                  type="password"
                  placeholder="Password"
                  onChange={(e: any) => {
                     setPassword(e.target.value);
                  }}
               />
            </div>
         </div>
         <div className="flex flex-col text-end gap-3 mt-8">
            <Button
               onClick={onClickHandler}
               className="py-3 px-4 text-white rounded-lg border-2 border-gray-800"
               disabled={!isLoading}
            >
               {isLoading
                  ?
                  <p>Sign In</p>
                  :
                  <LoadingCircle />
               }
            </Button>
            <Link
               to={'/register'}
               className="hover:underline"
            >Do not have an account yet? Sign Up </Link>
         </div>
      </div>
      <SourceCode link={"https://github.com/imkurosaki/real-time-quiz"} />
   </div>
}

export function ErrorIcons() {
   return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
   </svg>
}
