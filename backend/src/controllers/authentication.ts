import { Response, Request } from 'express';
import { generateToken } from '../lib/generateToken';

const handleSocialSignIn = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    return res
      .status(200)
      .cookie('token', `Bearer ${generateToken({ userId: userId })}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      })
      .redirect(`https://intellequiz.vercel.app/room?auth=success`);
  } catch (e: any) {
    console.log(e);
  }
}

const getCurrentUser = async (req: Request, res: Response) => {
  const user: any = req.user;
  return res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    image: user.image
  });
}

export const authController = {
  handleSocialSignIn,
  getCurrentUser
};
