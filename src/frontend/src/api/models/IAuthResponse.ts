export interface ICurrentUser {
  id: string;
  email: string;
}

export interface IAuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: ICurrentUser;
}
