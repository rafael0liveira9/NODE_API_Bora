const { jwtUncrypt } = require('../../utils/midleware/auth'),
    p = require('../../lib/prisma'),
    { verify, sign } = require("jsonwebtoken"),
    s3 = require('../s3/index'),
    { compareSync, hashSync } = require('bcryptjs'),
    error = {
        status: 500,
        message: "Erro Interno"
    },
    moment = require('moment');

const GetUserById = async (req, res) => {

    const adminCheck = await jwtUncrypt(req.headers.authorization)

    if (!adminCheck?.user) {
        return res.status(403).json({
            message: "Usuário não autorizado."
        });
    }

    const { id } = req.params;
    const data = await p.user.findFirst({
        where: {
            id: parseInt(id),
            situation: 1,
            deletedAt: null
        },
        select: {
            id: true,
            email: true,
            lastPaymentId: true,
            situation: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            client: true,
        }
    })


    if (data) {
        return res.status(201).json({
            user: data
        });
    } else {
        return res.status(401).json({
            message: "Usuário não cadastrado."
        });
    }

},
    GetMyUser = async (req, res) => {

        const adminCheck = await jwtUncrypt(req.headers.authorization)

        if (!adminCheck?.user?.email) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        }

        const data = await p.user.findFirst({
            where: {
                email: adminCheck?.user?.email,
                situation: 1,
                deletedAt: null
            },
            include: {
                client: true,
            },
        });



        if (data) {
                return res.status(201).json({
                user: data
            });
        } else {
                return res.status(401).json({
                message: "Usuário não cadastrado."
            });
        }

    },
    SignUp = async (req, res) => {

        const userData = req.body;
        const { type } = req.params;

        const already = await p.user.findFirst({
            where: {
                email: userData.email,
                deletedAt: null
            }
        })

        if (!!already) {
                return res.status(302).json({
                situation: already.situation
            });
        } else {
            const client = await p.client.create({
                data: {
                    name: userData.name,
                    userType: parseInt(type),
                }
            });

            if (client) {
                const user = await p.user.create({
                    data: {
                        email: userData.email,
                        password: hashSync(userData.password, 8),
                        clientId: client.id,
                    }
                })

                if (user) {
            
                    user.token = sign({
                        id: user.id,
                        name: client.name,
                        nick: client.nick,
                        email: user.email,
                        type: client.userType
                    }, process.env.SECRET_CLIENT_KEY)

                    return res.status(201).json({
                        data: {
                            user: user,
                            client: client
                        }
                    });
                } else {
                                return res.status(500).json({
                        message: "Erro ao criar user"
                    });
                }
            } else {
                        return res.status(500).json({
                    message: "Erro ao criar client"
                });
            }
        }

    },
    SignIn = async (req, res) => {

        try {

            const alreadyUser = await p.user.findFirst({
                where: {
                    email: req.body.email,
                    deletedAt: null
                },
                include: {
                    client: true
                }
            })

            if (!alreadyUser) {
                        return res.status(401).json({
                    message: "Usuário não existe"
                });
            }

            const passwordIsCorrect = compareSync(req.body.password, alreadyUser.password);


            console.log('passwordIsCorrect', passwordIsCorrect)
            if (!passwordIsCorrect) {
                        return res.status(401).json({
                    message: "Senha incorreta"
                });
            }

            // Verificar se o usuário está bloqueado
            if (alreadyUser?.client?.bannedUntil) {
                const now = new Date();
                const bannedUntil = new Date(alreadyUser.client.bannedUntil);

                if (bannedUntil > now) {
                                return res.status(403).json({
                        message: "Usuário bloqueado",
                        bannedUntil: bannedUntil
                    });
                }
            }

            // Buscar se o usuário é responsável de alguma empresa
            const userCompany = await p.companies.findFirst({
                where: {
                    responsibleId: alreadyUser.id,
                    situation: 1
                }
            });

            alreadyUser.token = sign({
                id: alreadyUser.id,
                name: alreadyUser?.client.name,
                nick: alreadyUser?.client.nick,
                email: alreadyUser.email,
                type: alreadyUser?.client?.userType,
                companyId: userCompany?.id || null
            }, process.env.SECRET_CLIENT_KEY)

            return res.status(200).json({
                message: "Usuário Logado Sucesso",
                user: {
                    id: alreadyUser.id,
                    email: alreadyUser.email,
                    name: alreadyUser.client.name,
                    nick: alreadyUser.client.nick,
                    type: alreadyUser?.client?.userType,
                    companyId: userCompany?.id || null,
                    token: alreadyUser.token,
                }
            });
        } catch (error) {
                return res.status(500).json({
                message: "Erro ao fazer Login"
            });
        }
    },
    EditUser = async (req, res) => {

        const adminCheck = await jwtUncrypt(req.headers.authorization)
        let editId;

        if (!adminCheck?.user) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        } else {
            editId = adminCheck?.user?.id
        }

        const userData = req.body;

        const alreadyUser = await p.user.findFirst({
            where: {
                id: editId
            },
            include: {
                client: true
            }
        })

        const userEdited = await p.user.update({
            where: {
                id: alreadyUser?.id
            },
            data: {
                email: userData.email ? userData.email : alreadyUser.email,
                tip: userData.tip ? userData.tip : alreadyUser.tip,
                reply: userData.reply ? userData.reply : alreadyUser.reply,
                questionId: userData.questionId ? userData.questionId : alreadyUser.questionId,
                updatedAt: new Date()
            }
        });

        const client = await p.client.update({
            where: {
                id: alreadyUser?.client?.id
            },
            data: {
                name: userData.name ? userData.name : alreadyUser.client.name,
                description: userData.description ? userData.description : alreadyUser.client.description,
                nick: userData.nick ? userData.nick : alreadyUser.client.nick,
                phone: userData.phone ? userData.phone : alreadyUser.client.phone,
                instagram: userData.instagram ? userData.instagram : alreadyUser.client.instagram,
                gender: userData.gender ? userData.gender : alreadyUser.client.gender,
                birthDate: userData.birthDate ? userData.birthDate : alreadyUser.client.birthDate,
                document: userData.document ? userData.document : alreadyUser.client.document,
                updatedAt: new Date()
            }
        });

        console.log('client', client, userEdited)
        if (client || userEdited) {
    
            return res.status(201).json({
                message: "Usuário e cliente editados com sucesso"
            });
        } else {
                return res.status(500).json({
                message: "Erro ao editar client"
            });
        }


    },
    SuspendUser = async (req, res) => {

        const adminCheck = await jwtUncrypt(req.headers.authorization)
        let editId;

        if (!adminCheck?.user) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        } else {
            editId = adminCheck?.user?.id
        }

        const alreadyUser = await p.user.findFirst({
            where: {
                id: editId
            },
            include: {
                client: true
            }
        })

        const user = await p.user.update({
            where: {
                id: alreadyUser?.id
            },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        const client = await p.client.update({
            where: {
                id: alreadyUser?.client?.id
            },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        if (!!user && !!client) {
    
            return res.status(201).json({
                message: 'Usuário suspenso com sucesso.'
            });
        } else {
                return res.status(500).json({
                message: "Erro ao suspender usuário"
            });
        }
    },
    DeleteUser = async (req, res) => {

        const adminCheck = await jwtUncrypt(req.headers.authorization)
        let deleteUser;
        let deleteClient;

        if (!adminCheck?.user) {
            return res.status(401).json({
                message: "Usuário não autorizado."
            });
        }

        const alreadyUser = await p.user.findFirst({
            where: {
                id: parseInt(req?.params?.id)
            },
            include: {
                client: true
            }
        })
        deleteClient = await p.client.update({
            where: {
                id: alreadyUser?.client?.id
            },
            data: {
                name: 'removed',
                nick: 'removed',
                nick: 'removed',
                phone: 'removed',
                photo: 'removed',
                backgroundImage: 'removed',
                description: 'removed',
                instagram: 'removed',
                document: 'removed',
                cref: 'removed',
                gender: null,
                birthDate: null,
                situation: 0,
                deletedAt: new Date()
            }
        })

        if (!!deleteClient) {
            deleteUser = await p.user.update({
                where: {
                    id: alreadyUser?.id
                },
                data: {
                    email: 'removed',
                    password: 'removed',
                    socialCode: 'removed',
                    inputCode: 'removed',
                    tip: 'removed',
                    reply: 'removed',
                    questionId: null,
                    situation: 0,
                    deletedAt: new Date()
                }
            })
        }



        if (!!deleteUser) {
                return res.status(201).json({
                message: "Usuário Deletado com sucesso."
            });
        } else {
                if (!deleteUser) {
                return res.status(201).json({
                    message: "Erro ao deletar usuário."
                });
            }
            if (!deleteClient) {
                return res.status(201).json({
                    message: "Erro ao deletar cliente."
                });
            }
        }
    },
    PhotoUpdate = async (req, res) => {
        let editId;
        let result;
        const file = req.file;
        const path = req.body?.path || 'error-path';
        const adminCheck = await jwtUncrypt(req.headers.authorization)


        if (!adminCheck?.user) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        } else {
            editId = adminCheck?.user?.id
        }

        const alreadyUser = await p.user.findFirst({
            where: {
                id: editId
            },
            include: {
                client: true
            }
        })

        try {
            result = await s3.uploadImage(file, path);

            if (result) {
                client = await p.client.update({
                    where: {
                        id: alreadyUser?.client?.id
                    },
                    data: {
                        photo: result.Location,
                        updatedAt: new Date()
                    }
                });

                        return res.status(201).json({
                    url: result.Location
                });

            } else {
                        return res.status(500).json({
                    message: "Erro ao inserir iage no s3 "
                });
            }

        } catch (error) {
                console.error(error);
            res.status(500).json({ message: 'Erro no upload' });
        }


    },
    backgroundImageUpdate = async (req, res) => {
        let editId;
        let result;
        const file = req.file;
        const path = req.body?.path || 'error-path';
        const adminCheck = await jwtUncrypt(req.headers.authorization)


        if (!adminCheck?.user) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        } else {
            editId = adminCheck?.user?.id
        }

        const alreadyUser = await p.user.findFirst({
            where: {
                id: editId
            },
            include: {
                client: true
            }
        })

        try {
            result = await s3.uploadImage(file, path);

            if (result) {
                client = await p.client.update({
                    where: {
                        id: alreadyUser?.client?.id
                    },
                    data: {
                        backgroundImage: result.Location,
                        updatedAt: new Date()
                    }
                });

                        return res.status(201).json({
                    url: result.Location
                });

            } else {
                        return res.status(500).json({
                    message: "Erro ao inserir iage no s3 "
                });
            }

        } catch (error) {
                console.error(error);
            res.status(500).json({ message: 'Erro no upload' });
        }


    }, GetAllClients = async (req, res, searchString, page, pageSize) => {
        console.log('GetAllClients 🚀')

        if (!req.headers.authorization) {
            return res.status(500).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization)

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const loggedUser = await p.user.findFirst({
            where: { id: user.user.id },
            include: { client: true }
        });

        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        try {
            // Usando SQL raw para contornar bug do Prisma no Windows
            let query = `
                SELECT c.*, u.id as userId
                FROM client c
                LEFT JOIN user u ON u.clientId = c.id
                WHERE c.situation = 1
                AND c.deletedAt IS NULL
            `;

            const params = [];

            if (searchString) {
                query += ` AND (c.name LIKE ? OR c.nick LIKE ?)`;
                params.push(`%${searchString}%`, `%${searchString}%`);
            }

            query += ` ORDER BY c.name ASC`;

            const allClients = await p.$queryRawUnsafe(query, ...params);

            // Filtrar o próprio usuário
            const filteredClients = allClients.filter(client => client.id !== loggedUser?.client?.id);

            const total = filteredClients.length;
            const startIndex = (pageNumber - 1) * pageLimit;
            const endIndex = startIndex + pageLimit;
            const paginatedClients = filteredClients.slice(startIndex, endIndex);

    
            return res.status(200).json({
                page: pageNumber,
                pageSize: pageLimit,
                total,
                clients: paginatedClients
            });

        } catch (error) {
                console.log(error);
            return res.status(500).json({ message: "Erro ao resgatar clientes" });
        }
    }
const ForgotPassword = async (req, res) => {
    console.log('ForgotPassword 🔑');

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email é obrigatório."
            });
        }

        // Buscar usuário pelo email
        const user = await p.user.findFirst({
            where: {
                email: email,
                deletedAt: null
            }
        });

        if (!user) {
            // Por segurança, retornar sucesso mesmo se o email não existir
            return res.status(200).json({
                message: "Se o email existir, um código de recuperação será enviado."
            });
        }

        // Gerar código de 6 dígitos
        const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Definir expiração para 15 minutos
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        // Salvar código e expiração no banco
        await p.user.update({
            where: { id: user.id },
            data: {
                inputCode: recoveryCode,
                resetPasswordExpires: expiresAt
            }
        });

        // TODO: Enviar email com o código usando Resend
        // Por enquanto, apenas log o código (REMOVA EM PRODUÇÃO!)
        console.log(`📧 Código de recuperação para ${email}: ${recoveryCode}`);

        return res.status(200).json({
            message: "Se o email existir, um código de recuperação será enviado.",
            // REMOVA em produção - apenas para testes
            code: recoveryCode
        });

    } catch (error) {
        console.error("❌ Erro no ForgotPassword:", error);
        return res.status(500).json({
            message: "Erro ao processar recuperação de senha."
        });
    }
};

const ResetPassword = async (req, res) => {
    console.log('ResetPassword 🔐');

    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({
                message: "Email, código e nova senha são obrigatórios."
            });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({
                message: "A senha deve ter no mínimo 4 caracteres."
            });
        }

        // Buscar usuário
        const user = await p.user.findFirst({
            where: {
                email: email,
                inputCode: code,
                deletedAt: null
            }
        });

        if (!user) {
            return res.status(400).json({
                message: "Código inválido ou expirado."
            });
        }

        // Verificar se o código expirou
        if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
            return res.status(400).json({
                message: "Código expirado. Solicite um novo código."
            });
        }

        // Atualizar senha e limpar código
        await p.user.update({
            where: { id: user.id },
            data: {
                password: hashSync(newPassword, 8),
                inputCode: null,
                resetPasswordExpires: null,
                updatedAt: new Date()
            }
        });

        return res.status(200).json({
            message: "Senha redefinida com sucesso!"
        });

    } catch (error) {
        console.error("❌ Erro no ResetPassword:", error);
        return res.status(500).json({
            message: "Erro ao redefinir senha."
        });
    }
};

module.exports = { GetAllClients, GetUserById, GetMyUser, SignUp, SignIn, EditUser, SuspendUser, DeleteUser, PhotoUpdate, backgroundImageUpdate, ForgotPassword, ResetPassword };