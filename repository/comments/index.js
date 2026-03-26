const { textCheck } = require('../../utils');
const { jwtUncrypt } = require('../../utils/midleware/auth');
const p = require('../../lib/prisma');

// Criar comentário ou réplica
const CreateComment = async (req, res) => {
    console.log('CreateComment 🚀');

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
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        if (!alreadyClient?.client?.id) {
            return res.status(403).json({ message: "Cliente não autorizado." });
        }

        const { content, postId, parentCommentId } = req.body;

        if (!content || !postId) {
            return res.status(400).json({ message: "Conteúdo e postId são obrigatórios." });
        }

        // Verificar e filtrar conteúdo proibido
        let censored = false;
        let contentChecked = content;

        const contentResult = textCheck(content);
        censored = !contentResult.ok;
        contentChecked = contentResult.text;

        console.log("🔒 Comentário censurado?", censored);
        console.log("📝 Conteúdo:", contentChecked);

        const type = parentCommentId ? 2 : 1; // 1 = comment, 2 = reply

        const comment = await p.comments.create({
            data: {
                content: contentChecked,
                postId: parseInt(postId),
                authorId: alreadyClient.client.id,
                parentCommentId: parentCommentId ? parseInt(parentCommentId) : null,
                type
            }
        });

        // Se teve censura, criar um alerta
        if (censored === true) {
            await p.forbiddenAlerts.create({
                data: {
                    text: content, // Texto original não censurado
                    postCommentId: comment.id,
                    clientId: alreadyClient.client.id,
                },
            });
        }

        return res.status(201).json({ comment, censored });
    } catch (error) {
        console.error("❌ Erro ao criar comentário:", error);
        return res.status(500).json({ message: "Erro ao criar comentário." });
    }
};

// Buscar comentários de um post
const GetCommentsByPost = async (req, res) => {
    console.log('GetCommentsByPost 🚀');

    try {
        const { postId } = req.params;

        if (!postId) {
            return res.status(400).json({ message: "PostId é obrigatório." });
        }

        // Usar SQL raw para evitar bug do Prisma
        const comments = await p.$queryRawUnsafe(`
            SELECT
                c.*,
                cl.id as author_id,
                cl.name as author_name,
                cl.nick as author_nick,
                cl.photo as author_photo
            FROM comments c
            INNER JOIN client cl ON c.authorId = cl.id
            WHERE c.postId = ?
            AND c.situation = 1
            AND c.deletedAt IS NULL
            ORDER BY c.createdAt ASC
        `, parseInt(postId));

        // Organizar comentários e réplicas
        const commentsMap = {};
        const rootComments = [];

        comments.forEach(comment => {
            commentsMap[comment.id] = {
                ...comment,
                author: {
                    id: comment.author_id,
                    name: comment.author_name,
                    nick: comment.author_nick,
                    photo: comment.author_photo
                },
                replies: []
            };
        });

        comments.forEach(comment => {
            if (comment.parentCommentId) {
                if (commentsMap[comment.parentCommentId]) {
                    commentsMap[comment.parentCommentId].replies.push(commentsMap[comment.id]);
                }
            } else {
                rootComments.push(commentsMap[comment.id]);
            }
        });

        return res.status(200).json({ comments: rootComments });
    } catch (error) {
        console.error("❌ Erro ao buscar comentários:", error);
        return res.status(500).json({ message: "Erro ao buscar comentários." });
    }
};

// Editar comentário
const UpdateComment = async (req, res) => {
    console.log('UpdateComment 🚀');

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
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        const { commentId, content } = req.body;

        if (!commentId || !content) {
            return res.status(400).json({ message: "CommentId e conteúdo são obrigatórios." });
        }

        // Verificar se o comentário pertence ao usuário
        const comment = await p.comments.findFirst({
            where: {
                id: parseInt(commentId),
                authorId: alreadyClient.client.id,
                situation: 1
            },
            include: {
                forbiddenAlerts: true
            }
        });

        if (!comment) {
            return res.status(403).json({ message: "Comentário não encontrado ou você não tem permissão." });
        }

        // Verificar e filtrar conteúdo proibido
        let censored = false;
        let contentChecked = content;

        const contentResult = textCheck(content);
        censored = !contentResult.ok;
        contentChecked = contentResult.text;

        console.log("🔒 Atualização censurada?", censored);
        console.log("📝 Conteúdo:", contentChecked);

        const updatedComment = await p.comments.update({
            where: { id: parseInt(commentId) },
            data: {
                content: contentChecked,
                updatedAt: new Date()
            }
        });

        // Atualizar alerta existente ou criar novo
        if (Array.isArray(comment?.forbiddenAlerts) && comment.forbiddenAlerts.length > 0) {
            const lastAlert = await p.forbiddenAlerts.findFirst({
                where: { postCommentId: comment.id },
                orderBy: { createdAt: 'desc' },
            });

            if (lastAlert) {
                await p.forbiddenAlerts.update({
                    where: { id: lastAlert.id },
                    data: {
                        updatedText: content,
                        updatedAt: new Date(),
                    },
                });
            }
        }

        // Se teve censura na atualização, criar novo alerta
        if (censored === true) {
            await p.forbiddenAlerts.create({
                data: {
                    text: content,
                    postCommentId: comment.id,
                    clientId: alreadyClient.client.id,
                },
            });
        }

        return res.status(200).json({ comment: updatedComment, censored });
    } catch (error) {
        console.error("❌ Erro ao atualizar comentário:", error);
        return res.status(500).json({ message: "Erro ao atualizar comentário." });
    }
};

// Deletar comentário
const DeleteComment = async (req, res) => {
    console.log('DeleteComment 🚀');

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
                deletedAt: null
            },
            include: {
                client: true
            }
        });

        const { commentId } = req.body;

        if (!commentId) {
            return res.status(400).json({ message: "CommentId é obrigatório." });
        }

        // Buscar comentário com o post
        const comment = await p.comments.findFirst({
            where: {
                id: parseInt(commentId),
                situation: 1
            },
            include: {
                post: {
                    include: {
                        company: true
                    }
                }
            }
        });

        if (!comment) {
            return res.status(404).json({ message: "Comentário não encontrado." });
        }

        // Verificar permissões:
        // 1. É o autor do comentário
        const isCommentAuthor = comment.authorId === alreadyClient.client.id;

        // 2. É o dono do post (se post é de cliente)
        const isPostOwner = comment.post.authorId && comment.post.authorId === alreadyClient.client.id;

        // 3. É o responsável da empresa (se post é de empresa)
        const isCompanyResponsible = comment.post.companyId &&
            comment.post.company?.responsibleId === user.user.id;

        if (!isCommentAuthor && !isPostOwner && !isCompanyResponsible) {
            return res.status(403).json({
                message: "Você não tem permissão para deletar este comentário."
            });
        }

        await p.comments.update({
            where: { id: parseInt(commentId) },
            data: {
                situation: 0,
                deletedAt: new Date()
            }
        });

        return res.status(200).json({ message: "Comentário deletado com sucesso." });
    } catch (error) {
        console.error("❌ Erro ao deletar comentário:", error);
        return res.status(500).json({ message: "Erro ao deletar comentário." });
    }
};

module.exports = { CreateComment, GetCommentsByPost, UpdateComment, DeleteComment };
