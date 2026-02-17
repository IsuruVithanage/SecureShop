/**
 *
 * token.js
 * axios default headers setup
 */



import axios from 'axios';

// Set withCredentials to true for all requests to include cookies
axios.defaults.withCredentials = true;

const setToken = token => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = token;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export default setToken;