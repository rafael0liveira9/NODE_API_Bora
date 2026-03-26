const p = require('../../lib/prisma'),
    { verify, sign } = require("jsonwebtoken"),
    { compareSync, hashSync } = require('bcryptjs'),
    error = {
        status: 500,
        message: "Erro Interno"
    },

    // **************************************** JWT TEST
    jwtUncrypt = async (jwt) => {

        try {
            // Remove "Bearer " prefix if present
            let token = jwt;
            if (jwt && jwt.startsWith('Bearer ')) {
                token = jwt.substring(7);
            }

            // Validate token exists
            if (!token || token.trim() === '') {
                return {
                    status: 401,
                    message: "Token inválido ou ausente"
                };
            }

            const decoded = verify(token, process.env.SECRET_CLIENT_KEY);

            const alreadyUser = await p.user.findFirst({
                where: {
                    email: decoded.email,
                    deletedAt: null
                }
            })

            if (!alreadyUser) {
                return {
                    status: 401,
                    message: "Usuário não autênticado"
                }
            }

            return {
                status: 201,
                message: "Usuário autênticado",
                user: {
                    id: decoded.id,
                    email: decoded.email,
                    name: decoded.name,
                    nick: decoded.nick,
                    type: decoded.type
                }
            }

        } catch (error) {
            console.log(error, "Erro ao autênticar user");
            return {
                status: 401,
                message: "Token inválido ou expirado"
            };
        }
    }


module.exports = { jwtUncrypt };