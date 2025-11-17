const { Router, json, urlencoded } = require('express'),
    moment = require('moment'),
    multer = require('multer'),
    user = require('../repository/user'),
    general = require('../repository/general'),
    relations = require('../repository/relationships'),
    posts = require('../repository/posts'),
    comments = require('../repository/comments'),
    images = require('../repository/images'),
    blocks = require('../repository/blocks'),
    genders = require('../repository/genders'),
    companies = require('../repository/companies'),
    events = require('../repository/events'),
    eventCapacity = require('../repository/eventCapacity'),
    eventTypes = require('../repository/eventTypes'),
    participation = require('../repository/participation'),
    s3 = require('../repository/s3'),
    router = Router();

const upload = multer();

router.use(json());
router.use(urlencoded({ extended: true }));
router.get('/', async (_, res) => res.json({ message: process.env.TEST }));

// *********************************************************************************************** s3 ROUTES
router.post('/upload-image', upload.single('file'), async (req, res) => s3.ImportImageToS3(req, res));

// *********************************************************************************************** USER ROUTES
router.get('/user/:id', async (req, res) => user.GetUserById(req, res)),
    router.get('/get-my-user', async (req, res) => user.GetMyUser(req, res)),
    router.get('/get-clients', async (req, res) => {
        const searchString = req.query.string;
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await user.GetAllClients(req, res, searchString, page, pageSize);
    }),
    router.post('/user/:type', async (req, res) => user.SignUp(req, res)),
    router.post('/sign-in', async (req, res) => user.SignIn(req, res)),
    router.post('/forgot-password', async (req, res) => user.ForgotPassword(req, res)),
    router.post('/reset-password', async (req, res) => user.ResetPassword(req, res)),
    router.put('/user', async (req, res) => user.EditUser(req, res)),
    router.put('/photo-user', upload.single('file'), async (req, res) => user.PhotoUpdate(req, res)),
    router.put('/background-user', upload.single('file'), async (req, res) => user.backgroundImageUpdate(req, res)),
    router.put('/suspend-user', async (req, res) => user.SuspendUser(req, res)),
    router.put('/delete-user/:id', async (req, res) => user.DeleteUser(req, res));


// *********************************************************************************************** POST ROUTES
router.get('/posts', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await posts.GetAllPosts(req, res, page, pageSize);
    }),
    router.get('/my-posts', async (req, res) => posts.GetMyPosts(req, res)),
    router.get('/user-posts/:clientId', async (req, res) => posts.GetUserPosts(req, res)),
    router.post('/post', async (req, res) => posts.PostPostkk(req, res)),
    router.put('/post', async (req, res) => posts.PutPostkk(req, res)),
    router.put('/delete-post', async (req, res) => posts.DeletePostkk(req, res));

// *********************************************************************************************** COMMENTS ROUTES
router.get('/comments/:postId', async (req, res) => comments.GetCommentsByPost(req, res)),
    router.post('/comment', async (req, res) => comments.CreateComment(req, res)),
    router.put('/comment', async (req, res) => comments.UpdateComment(req, res)),
    router.delete('/comment', async (req, res) => comments.DeleteComment(req, res));

// *********************************************************************************************** FAQ ROUTES
router.get('/faq', async (req, res) => general.GetFaq(req, res));

// *********************************************************************************************** RELATIONSHIPS ROUTES
router.get('/friends', async (req, res) => relations.GetMyFriends(req, res)),
    router.get('/friends-request', async (req, res) => relations.GetMyFriendRequest(req, res)),
    router.post('/friends-request-post', async (req, res) => relations.PostFriendship(req, res)),
    router.put('/friends-accept', async (req, res) => relations.AcceptFriendship(req, res));

// *********************************************************************************************** IMAGES ROUTES
router.get('/my-images', async (req, res) => images.GetMyImages(req, res)),
    router.get('/user-images/:clientId', async (req, res) => images.GetUserImages(req, res)),
    router.post('/image', async (req, res) => images.AddImage(req, res)),
    router.delete('/image', async (req, res) => images.DeleteImage(req, res)),
    router.put('/reorder-images', async (req, res) => images.ReorderImages(req, res));

// *********************************************************************************************** BLOCKS ROUTES
router.get('/blocks/:targetUserId', async (req, res) => blocks.GetBlocksByUser(req, res)),
    router.post('/block', async (req, res) => blocks.CreateBlock(req, res)),
    router.put('/block', async (req, res) => blocks.RemoveBlock(req, res));

// *********************************************************************************************** GENDERS ROUTES
router.get('/genders', async (req, res) => genders.GetAllGenders(req, res)),
    router.post('/genders/seed', async (req, res) => genders.SeedGenders(req, res));

// *********************************************************************************************** COMPANIES ROUTES
router.get('/companies', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        const search = req.query.search;
        await companies.GetAllCompanies(req, res, page, pageSize, search);
    }),
    router.get('/company/:id', async (req, res) => companies.GetCompanyById(req, res)),
    router.post('/company', async (req, res) => companies.CreateCompany(req, res)),
    router.put('/company', async (req, res) => companies.UpdateCompany(req, res)),
    router.delete('/company', async (req, res) => companies.DeleteCompany(req, res));

// *********************************************************************************************** COMPANY POSTS ROUTES
router.get('/company-posts', async (req, res) => companies.GetCompanyPosts(req, res)),
    router.post('/company-post', async (req, res) => companies.CreateCompanyPost(req, res)),
    router.put('/company-post', async (req, res) => companies.UpdateCompanyPost(req, res)),
    router.delete('/company-post', async (req, res) => companies.DeleteCompanyPost(req, res));

// *********************************************************************************************** EVENT TYPES ROUTES
router.get('/event-types', async (req, res) => eventTypes.GetAllEventTypes(req, res));

// *********************************************************************************************** EVENTS ROUTES
router.get('/public-events', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await events.GetPublicEvents(req, res, page, pageSize);
    }),
    router.get('/events', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        const search = req.query.search;
        await events.GetAllEvents(req, res, page, pageSize, search);
    }),
    router.get('/event/:id', async (req, res) => events.GetEventById(req, res)),
    router.get('/my-company-events', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await events.GetMyCompanyEvents(req, res, page, pageSize);
    }),
    router.get('/company-events/:companyId', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await events.GetEventsByCompanyId(req, res, page, pageSize);
    }),
    router.post('/event', async (req, res) => events.CreateEvent(req, res)),
    router.put('/event', async (req, res) => events.UpdateEvent(req, res)),
    router.delete('/event', async (req, res) => events.DeleteEvent(req, res));

// *********************************************************************************************** EVENT CAPACITY ROUTES
router.get('/event-capacity/:eventId', async (req, res) => eventCapacity.GetEventCapacity(req, res)),
    router.get('/event-capacity-history/:eventId', async (req, res) => {
        const page = req.query.page;
        const pageSize = req.query.pageSize;
        await eventCapacity.GetEventCapacityHistory(req, res, page, pageSize);
    }),
    router.get('/my-company-capacity-summary', async (req, res) => eventCapacity.GetMyCompanyEventCapacitySummary(req, res)),
    router.post('/event-capacity-deposit', async (req, res) => eventCapacity.AddCapacity(req, res)),
    router.post('/event-capacity-checkin', async (req, res) => eventCapacity.RemoveCapacity(req, res));

// *********************************************************************************************** PARTICIPATION ROUTES
router.post('/participation', async (req, res) => participation.UpsertParticipation(req, res)),
    router.get('/participation/:eventId', async (req, res) => participation.GetUserParticipation(req, res)),
    router.get('/event-participations/:eventId', async (req, res) => participation.GetEventParticipations(req, res));

module.exports = router