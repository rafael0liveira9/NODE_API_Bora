const { json } = require('body-parser');
const { textCheck } = require('../../utils');
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

const GetAllPosts = async (req, res, page, pageSize) => {
    console.log('GetAllPosts 🚀')

    try {
        if (!req.headers.authorization) {
            return res.status(500).json({
                message: "JWT é necessário."
            });
        }

        const user = await jwtUncrypt(req.headers.authorization)

        if (!user?.user?.id) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        })

        const pageNumber = Number(page) || 1;
        const pageLimit = Number(pageSize) || 10;

        const posts = await p.posts.findMany({
            where: {
                situation: 1
                // Removido filtro de type para mostrar todos os posts (clientes e empresas)
            },
            include: {
                client: {
                    include: true
                },
                company: true,
                _count: {
                    select: {
                        comments: {
                            where: {
                                situation: 1
                            }
                        }
                    }
                }
            }
        });

        console.log('📊 Total de posts encontrados:', posts.length);
        console.log('📋 Posts:', posts.map(p => ({ id: p.id, title: p.title, type: p.type, situation: p.situation, clientSituation: p.client?.situation, companySituation: p.company?.situation })));

        // Filtrar posts de clientes ou empresas ativos
        const filteredPosts = posts.filter(post =>
            (post.client?.situation === 1) || (post.company?.situation === 1)
        );

        console.log('✅ Posts após filtro de cliente:', filteredPosts.length);


        if (!filteredPosts) {
            return res.status(500).json({
                message: "Erro ao resgatar posts",
            });
        }

        const PRIORITY_MAP = {
            1: 5,
            5: 4,
            4: 3,
            3: 2,
            2: 1,
        };

        filteredPosts.sort((a, b) => {
            // Prioridade: empresa = 5, cliente depende do userType
            const priorityA = a.company ? 5 : (PRIORITY_MAP[a.client?.userType] || 0);
            const priorityB = b.company ? 5 : (PRIORITY_MAP[b.client?.userType] || 0);

            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }

            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        const now = new Date();
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;

        const recentPosts = filteredPosts.filter(
            (post) => now.getTime() - new Date(post.createdAt).getTime() <= TWELVE_HOURS
        );
        const otherPosts = filteredPosts.filter(
            (post) => now.getTime() - new Date(post.createdAt).getTime() > TWELVE_HOURS
        );

        const finalSortedPosts = [...recentPosts, ...otherPosts];

        const total = finalSortedPosts.length;
        const startIndex = (pageNumber - 1) * pageLimit;
        const endIndex = startIndex + pageLimit;
        const paginatedPosts = finalSortedPosts.slice(startIndex, endIndex);

        return res.status(200).json({
            page: pageNumber,
            pageSize: pageLimit,
            total,
            posts: paginatedPosts
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Erro ao iniciar execução"
        });
    }

}, GetMyPosts = async (req, res) => {
    console.log('GetMyPosts 🚀')

    try {
        if (!req.headers.authorization) {
            return res.status(500).json({
                message: "JWT é necessário."
            });
        }

        const user = await jwtUncrypt(req.headers.authorization)

        if (!user?.user?.id) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null
            },
            include: {
                client: true
            }
        })

        const posts = await p.posts.findMany({
            where: {
                authorId: alreadyClient.client.id,
                situation: 1
            },
            include: {
                _count: {
                    select: {
                        comments: {
                            where: {
                                situation: 1
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            alreadyClient,
            posts
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Erro ao iniciar execução"
        });
    }

}, PostPostkk = async (req, res) => {
    console.log("PostPostkk 🚀");

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null,
            },
            include: {
                client: true,
            },
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        let censored = false;
        let titleChecked = req.body.title || "";
        let descriptionChecked = req.body.description || "";
        let imageUpload;

        if (req.body.title && req.body.description) {
            const titleResult = textCheck(req.body.title);
            const descriptionResult = textCheck(req.body.description);

            censored = !titleResult.ok || !descriptionResult.ok;
            titleChecked = titleResult.text;
            descriptionChecked = descriptionResult.text;
        }

        console.log("🔒 Censurado?", censored);
        console.log("📝 Título:", titleChecked);
        console.log("📝 Descrição:", descriptionChecked);


        if (titleChecked || descriptionChecked || req.body.image) {
            const postData = {
                authorId: alreadyClient.client.id,
                title: titleChecked || null,
                description: descriptionChecked || null,
                image: req.body.image?.url || req.body.image || null,
                type: req.body.type || 1
            };

            console.log('📝 Criando post com dados:', postData);

            const post = await p.posts.create({
                data: postData,
            });

            console.log('✅ Post criado:', { id: post.id, type: post.type, situation: post.situation });

            if (!post) {
                return res.status(500).json({ message: "Erro ao salvar post." });
            }

            if (censored === true) {
                await p.forbiddenAlerts.create({
                    data: {
                        text: `${req.body.title ?? ''} |-| ${req.body.description ?? ''}`,
                        postId: post.id,
                        clientId: alreadyClient.client.id,
                    },
                });
            }

            return res.status(200).json({ post, censored });
        }


        return res.status(400).json({
            message: "É necessário enviar título, descrição ou imagem.",
        });
    } catch (error) {
        console.error("❌ Erro ao postar:", error);
        return res.status(500).json({ message: "Erro ao iniciar execução." });
    }
}, PutPostkk = async (req, res) => {
    console.log("PostPostkk 🚀");

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null,
            },
            include: {
                client: true,
            },
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const alreadyPost = await p.posts.findFirst({
            where: {
                id: req.body.id,
                situation: 1,
            },
            include: {
                forbiddenAlerts: true
            }
        });

        if (!alreadyPost?.id) {
            return res.status(403).json({ message: "Post não existe." });
        }

        let censored = false;
        let titleChecked = req.body.title || "";
        let descriptionChecked = req.body.description || "";
        let imageUpload;

        if (req.body.title && req.body.description) {
            const titleResult = textCheck(req.body.title);
            const descriptionResult = textCheck(req.body.description);

            censored = !titleResult.ok || !descriptionResult.ok;
            titleChecked = titleResult.text;
            descriptionChecked = descriptionResult.text;
        }

        console.log("🔒 Censurado?", censored);
        console.log("📝 Título:", titleChecked);
        console.log("📝 Descrição:", descriptionChecked);


        if (titleChecked || descriptionChecked || req.body.image) {
            const post = await p.posts.update({
                where: { id: alreadyPost.id },
                data: {
                    title: titleChecked || alreadyPost.title,
                    description: descriptionChecked || alreadyPost.description,
                    image: req.body.image || alreadyPost.image,
                    type: req.body.type || alreadyPost.type
                },
            });

            if (!post) {
                return res.status(500).json({ message: "Erro ao salvar post." });
            }


            if (Array.isArray(alreadyPost?.forbiddenAlerts) && alreadyPost.forbiddenAlerts.length > 0) {
                const lastAlert = await p.forbiddenAlerts.findFirst({
                    where: { postId: alreadyPost.id },
                    orderBy: { createdAt: 'desc' },
                });

                console.log('lastAlert', lastAlert)

                if (lastAlert) {
                    await p.forbiddenAlerts.update({
                        where: { id: lastAlert.id },
                        data: {
                            updatedText: `${req.body.title ?? ''} |-| ${req.body.description ?? ''}`,
                            updatedAt: new Date(),
                        },
                    });
                }
            }


            if (censored === true) {
                await p.forbiddenAlerts.create({
                    data: {
                        text: `${req.body.title ?? ''} |-| ${req.body.description ?? ''}`,
                        postId: alreadyPost.id,
                        clientId: alreadyClient.client.id,
                    },
                });
            }

            return res.status(200).json({ post, censored });
        }


        return res.status(400).json({
            message: "É necessário enviar título, descrição ou imagem.",
        });
    } catch (error) {
        console.error("❌ Erro ao postar:", error);
        return res.status(500).json({ message: "Erro ao iniciar execução." });
    }
}, DeletePostkk = async (req, res) => {
    console.log("PostPostkk 🚀");

    try {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: "JWT é necessário." });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({ message: "Usuário não encontrado." });
        }

        const alreadyClient = await p.user.findFirst({
            where: {
                id: user.user.id,
                deletedAt: null,
            },
            include: {
                client: true,
            },
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const alreadyPost = await p.posts.findFirst({
            where: {
                id: req.body.id,
                situation: 1,
            },
            include: {
                forbiddenAlerts: true
            }
        });

        if (!alreadyPost?.id) {
            return res.status(403).json({ message: "Post não existe." });
        }

        const deletePost = await p.posts.update({
            where: { id: alreadyPost.id },
            data: {
                situation: 0
            },
        });

        if (!!deletePost) {
            console.log('deletePost', deletePost)
            return res.status(200).json({
                message: "Post deletado.",
            });
        }
    } catch (error) {
        console.error("❌ Erro ao postar:", error);
        return res.status(500).json({ message: "Erro ao iniciar execução." });
    }
};



const GetUserPosts = async (req, res) => {
    console.log('GetUserPosts 🚀');

    try {
        if (!req.headers.authorization) {
            return res.status(500).json({
                message: "JWT é necessário."
            });
        }

        const user = await jwtUncrypt(req.headers.authorization);

        if (!user?.user?.id) {
            return res.status(401).json({
                message: "Usuário não encontrado."
            });
        }

        const { clientId } = req.params;

        const posts = await p.posts.findMany({
            where: {
                authorId: parseInt(clientId),
                situation: 1,
                type: 1 // Apenas posts públicos
            },
            include: {
                client: {
                    include: true
                },
                _count: {
                    select: {
                        comments: {
                            where: {
                                situation: 1
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            posts
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Erro ao buscar posts do usuário"
        });
    }
};

module.exports = { GetAllPosts, PostPostkk, PutPostkk, GetMyPosts, GetUserPosts, DeletePostkk };