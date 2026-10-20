import { getRepositories } from './createRepositories';

// All repositories and this boundary share one immutable selected bundle.
export const unitOfWork = getRepositories().unitOfWork;
